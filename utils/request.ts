import { publicAnonKey } from "./supabase/info";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface InvokeOptions {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
    cacheTtlMs?: number;
}

interface CacheEntry {
    expiresAt: number;
    data: unknown;
}

const FIXED_PROJECT_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const PREVIEW_PROJECT_HOST =
    process.env.NEXT_PUBLIC_SUPABASE_PREVIEW_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
const FUNCTION_BASE_URL = FIXED_PROJECT_HOST
    ? `${FIXED_PROJECT_HOST}/functions/v1`
    : "";

const PREVIEW_PROJECT_FUNCTIONS = [
    "RevByArea",
    "RevByComm",
    "RevByCommunity",
    "existingclientsrevchart",
    "Areas",
];

const inFlightRequests: Map<string, Promise<unknown>> = new Map();
const responseCache: Map<string, CacheEntry> = new Map();

function buildRequestKey(
    slug: string,
    method: HttpMethod,
    body?: unknown,
): string {
    const bodyKey = body === undefined ? "" : JSON.stringify(body);
    return `${slug}|${method}|${bodyKey}`;
}

export async function invokeFunction<T = unknown>(
    slug: string,
    options: InvokeOptions = {},
): Promise<T> {
    if (slug.startsWith("analytics/series/")) {
        slug = "analytics/" + slug.substring("analytics/series/".length);
    }

    const revByCommEnv = process.env.NEXT_PUBLIC_SUPABASE_REVCOMM;
    let revByCommSlug = "RevByComm";
    if (revByCommEnv) {
        if (revByCommEnv.startsWith("http")) {
            const parts = revByCommEnv.split("/");
            revByCommSlug = parts[parts.length - 1] || revByCommEnv;
        } else {
            revByCommSlug = revByCommEnv;
        }
    }

    const proxyMap: Record<string, string> = {
        "analytics/revenue-by-area": revByCommSlug,
        "analytics/existing-revenue": "existingclientsrevchart",
        "analytics/reports/monthly": "monthlyReportNvL",
        "analytics/areas": "Areas",
        "analytics/Areas": "Areas",
    };
    if (proxyMap[slug]) {
        slug = proxyMap[slug];
    }
    const method: HttpMethod = options.method || "POST";

    const projectHost = PREVIEW_PROJECT_FUNCTIONS.includes(slug)
        ? PREVIEW_PROJECT_HOST
        : FIXED_PROJECT_HOST;
    if (!projectHost) {
        throw new Error(
            `Missing Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL${PREVIEW_PROJECT_FUNCTIONS.includes(slug) ? " or NEXT_PUBLIC_SUPABASE_PREVIEW_URL" : ""} in your .env file`,
        );
    }
    const url = `${projectHost}/functions/v1/${slug}`;
    const key = buildRequestKey(slug, method, options.body);
    const ttl = options.cacheTtlMs ?? 1000;

    const now = Date.now();
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.data as T;
    }

    const existing = inFlightRequests.get(key);
    if (existing) {
        return (await existing) as T;
    }

    // Determine which anon key to use based on the function
    const isPreviewFunction = PREVIEW_PROJECT_FUNCTIONS.includes(slug);

    // In Next.js, environment variables must be accessed directly
    let anonFromEnv = "";
    if (typeof process !== "undefined" && process.env) {
        if (isPreviewFunction) {
            anonFromEnv =
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW || "";
            if (!anonFromEnv) {
                console.warn(
                    `Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW is not set. Function ${slug} requires this key.`,
                );
            } else {
                // Debug: log first few chars of key to verify it's being read (don't expose full key)
                console.log(
                    `[invokeFunction] Using NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW for ${slug} (key starts with: ${anonFromEnv.substring(0, 20)}...)`,
                );
            }
        } else {
            anonFromEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        }
    }

    const effectiveAnon =
        anonFromEnv || (isPreviewFunction ? "" : publicAnonKey);

    if (!effectiveAnon) {
        throw new Error(
            `Missing API key for function ${slug}. Please set ${isPreviewFunction ? "NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW" : "NEXT_PUBLIC_SUPABASE_ANON_KEY"} in your .env file`,
        );
    }

    if (isPreviewFunction && !anonFromEnv) {
        console.error(
            `[invokeFunction] ERROR: Preview function ${slug} is missing NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW. This will fail.`,
        );
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: effectiveAnon,
        Authorization: `Bearer ${effectiveAnon}`,
        ...(options.headers || {}),
    };

    const fetchPromise = (async () => {
        const res = await fetch(url, {
            method,
            headers,
            body:
                method === "GET"
                    ? undefined
                    : options.body
                      ? JSON.stringify(options.body)
                      : undefined,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Function ${slug} failed: ${res.status} ${text}`);
        }

        const data = (await res.json().catch(() => undefined)) as T;
        if (ttl > 0) {
            responseCache.set(key, { expiresAt: now + ttl, data });
        }
        return data;
    })();

    inFlightRequests.set(key, fetchPromise);
    try {
        const data = (await fetchPromise) as T;
        return data;
    } finally {
        inFlightRequests.delete(key);
    }
}
