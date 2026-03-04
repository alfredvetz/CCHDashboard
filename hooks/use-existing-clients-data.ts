import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type {
    ExistingClientRow,
    MonthlyExistingClientsData,
    ExistingClientsBulkResponse,
} from "@/types/api";

// Re-export types for backward compatibility
export type {
    ExistingClientRow,
    MonthlyExistingClientsData,
    ExistingClientsBulkResponse,
};

// Cache configuration
const CACHE_PREFIX = "cch_existing_clients_";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
    data: ExistingClientsBulkResponse;
    timestamp: number;
}

function firstOfNextMonthISO(iso: string): string {
    const [y, m] = iso.slice(0, 7).split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

// Cache utilities
function getCacheKey(
    apiFromDate: string,
    apiToDate: string,
    areasKey: string,
): string {
    return `${CACHE_PREFIX}${apiFromDate}_${apiToDate}_${areasKey}`;
}

function getFromCache(key: string): ExistingClientsBulkResponse | null {
    try {
        const cached = sessionStorage.getItem(key);
        if (!cached) return null;

        const entry: CacheEntry = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is still valid
        if (now - entry.timestamp > CACHE_TTL_MS) {
            sessionStorage.removeItem(key);
            return null;
        }

        return entry.data;
    } catch {
        return null;
    }
}

function setInCache(key: string, data: ExistingClientsBulkResponse): void {
    try {
        const entry: CacheEntry = {
            data,
            timestamp: Date.now(),
        };
        sessionStorage.setItem(key, JSON.stringify(entry));
    } catch (err) {
        // sessionStorage might be full or disabled - silently fail
        console.warn("Failed to cache data:", err);
    }
}

// Clean up old cache entries (call periodically)
function cleanupOldCacheEntries(): void {
    try {
        const now = Date.now();
        const keysToRemove: string[] = [];

        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith(CACHE_PREFIX)) {
                try {
                    const cached = sessionStorage.getItem(key);
                    if (cached) {
                        const entry: CacheEntry = JSON.parse(cached);
                        if (now - entry.timestamp > CACHE_TTL_MS) {
                            keysToRemove.push(key);
                        }
                    }
                } catch {
                    keysToRemove.push(key!);
                }
            }
        }

        keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    } catch {
        // Silently fail
    }
}

// Track active requests to prevent duplicates (especially from React StrictMode)
const activeRequests = new Set<string>();

export function useExistingClientsData(
    startMonth: string,
    endMonth: string,
    selectedAreas: string[] = [],
) {
    const [data, setData] = useState<ExistingClientsBulkResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    // Memoize the areas key to prevent unnecessary re-renders
    const areasKey = useMemo(() => {
        return [...selectedAreas].sort().join(",");
    }, [selectedAreas]);

    // Function to clear cache (can be called externally if needed)
    const clearCache = useCallback(() => {
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key?.startsWith(CACHE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => sessionStorage.removeItem(key));
        } catch {
            // Silently fail
        }
    }, []);

    useEffect(() => {
        if (!startMonth || !endMonth) return;

        // Calculate one month prior to startMonth to ensure we have baseline data for comparison
        const [sY, sM] = startMonth.split("-").map(Number);
        const startDateObj = new Date(Date.UTC(sY, sM - 1, 1));
        startDateObj.setUTCMonth(startDateObj.getUTCMonth() - 1);

        const apiFromDate = startDateObj.toISOString().slice(0, 10);
        const apiToDate = firstOfNextMonthISO(endMonth);

        // Create cache and request keys
        const cacheKey = getCacheKey(apiFromDate, apiToDate, areasKey);
        const requestKey = `existing-clients-${apiFromDate}-${apiToDate}-${areasKey}`;

        // Check cache first
        const cachedData = getFromCache(cacheKey);
        if (cachedData) {
            console.log(
                "[useExistingClientsData] Using cached data for:",
                requestKey,
            );
            setData(cachedData);
            setLoading(false);
            return;
        }

        // If this exact request is already in progress, don't make another one
        if (activeRequests.has(requestKey)) {
            return;
        }

        // Mark this request as active
        activeRequests.add(requestKey);
        isMountedRef.current = true;

        const fetchData = async () => {
            if (isMountedRef.current) {
                setLoading(true);
                setError(null);
            }

            try {
                const url = process.env.NEXT_PUBLIC_SUPABASE_EXISTREVCHART;
                const anonKey =
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW;

                if (!url || !anonKey) {
                    if (isMountedRef.current) {
                        setError(
                            "Configuration missing for Existing Clients API. Set NEXT_PUBLIC_SUPABASE_EXISTREVCHART and NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW in your .env file.",
                        );
                        setData(null);
                    }
                    return;
                }

                // Parse areasKey back to array for the API call
                const areasArray = areasKey
                    ? areasKey.split(",").filter(Boolean)
                    : [];

                console.log(
                    "[useExistingClientsData] Fetching from API:",
                    requestKey,
                );
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${anonKey}`,
                        apikey: String(anonKey),
                    },
                    body: JSON.stringify({
                        start_date: apiFromDate,
                        end_date: apiToDate,
                        ...(areasArray.length > 0 ? { area: areasArray } : {}),
                    }),
                });

                if (!response.ok) {
                    const text = await response.text().catch(() => "");
                    throw new Error(`API failed: ${response.status} ${text}`);
                }

                const result =
                    (await response.json()) as ExistingClientsBulkResponse;

                // Cache the result
                setInCache(cacheKey, result);

                if (isMountedRef.current) {
                    setData(result);
                }
            } catch (err) {
                if (isMountedRef.current) {
                    console.error("Error fetching existing clients data:", err);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to fetch data",
                    );
                    setData(null);
                }
            } finally {
                if (isMountedRef.current) {
                    setLoading(false);
                }
                activeRequests.delete(requestKey);
            }
        };

        fetchData();

        return () => {
            activeRequests.delete(requestKey);
        };
    }, [startMonth, endMonth, areasKey]);

    useEffect(() => {
        cleanupOldCacheEntries();
    }, []);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return { data, loading, error, clearCache };
}
