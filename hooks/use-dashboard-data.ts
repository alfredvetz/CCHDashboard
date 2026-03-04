import { useEffect, useState, useRef } from "react";
import type { AreaFilterParams } from "@/types/api";

/** Transformed row for dashboard display */
export interface DashboardDataRow {
    /** Month in YYYY-MM-DD format */
    bucket: string;
    /** Total revenue for the month */
    total_revenue: number;
    /** Average revenue per client */
    avg_revenue: number;
}

/** Client count row for dashboard display */
export interface ClientCountRow {
    /** Month in YYYY-MM-DD format */
    bucket: string;
    /** Number of unique clients */
    client_count: number;
}

/**
 * Hook to fetch monthly revenue and client count data.
 * Uses the Monthly-Revenue edge function which returns aggregated stats.
 */
export function useDashboardData(
    startDate: string,
    endDate: string,
    edgeUrl: string,
    area?: AreaFilterParams["area"],
) {
    const [data, setData] = useState<DashboardDataRow[]>([]);
    const [clientCounts, setClientCounts] = useState<ClientCountRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Track active request keys to prevent duplicate calls
    // Using a Set allows us to track multiple potential requests atomically
    const activeRequestsRef = useRef<Set<string>>(new Set());
    const currentRequestRef = useRef<string | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        // Create a unique key for this request (include area for proper caching)
        const areaKey = Array.isArray(area)
            ? area.sort().join(",")
            : area || "all";
        const requestKey = `${startDate}-${endDate}-${edgeUrl}-${areaKey}`;

        // Check if this exact request is already in progress
        // This check happens synchronously BEFORE any fetch calls
        if (activeRequestsRef.current.has(requestKey)) {
            // Already fetching the exact same data - don't make another request
            return;
        }

        // Add this request key to the active set synchronously
        // This prevents React StrictMode double-invocation from creating duplicate requests
        activeRequestsRef.current.add(requestKey);
        currentRequestRef.current = requestKey;
        isMountedRef.current = true;

        setLoading(true);
        setError(null);

        // Fetch revenue data (which now includes client counts)
        const revenuePromise = fetch(edgeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
            },
            body: JSON.stringify({
                mode: "refresh",
                start_date: startDate,
                end_date: endDate,
                // Only include area parameter if a specific area is selected
                // If area is null/undefined, the edge function returns all areas
                ...(area ? { area } : {}),
            }),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(await res.text());
                return res.json();
            })
            .then((json) => {
                // Only update state if this is still the current request and component is mounted
                if (
                    isMountedRef.current &&
                    currentRequestRef.current === requestKey
                ) {
                    // Map the 'upserted' array to the expected shape for dashboard components
                    const rows = Array.isArray(json.upserted)
                        ? json.upserted.map((row: any) => ({
                              bucket: row.month_start,
                              total_revenue: row.total_revenue,
                              avg_revenue: row.avg_revenue ?? 0,
                          }))
                        : [];
                    setData(rows);

                    // Extract client counts from the same response
                    // Monthly-Revenue returns select('*') from mv_Monthly_Stats, so it has client_count
                    const countRows = Array.isArray(json.upserted)
                        ? json.upserted.map((row: any) => ({
                              bucket: row.month_start,
                              client_count: row.client_count ?? 0,
                          }))
                        : [];
                    setClientCounts(countRows);
                }
            })
            .catch((e) => {
                // Only set error if this is still the current request
                if (
                    isMountedRef.current &&
                    currentRequestRef.current === requestKey
                ) {
                    setError(e.message || "Failed to fetch dashboard data");
                }
            })
            .finally(() => {
                // Only update loading state if this is still the current request
                if (
                    isMountedRef.current &&
                    currentRequestRef.current === requestKey
                ) {
                    setLoading(false);
                }
                // Remove this request from the active set
                activeRequestsRef.current.delete(requestKey);
            });

        const activeRequests = activeRequestsRef.current;
        return () => {
            activeRequests.delete(requestKey);
        };
    }, [startDate, endDate, edgeUrl, area]);

    // Cleanup on unmount
    useEffect(() => {
        const isMounted = isMountedRef;
        const activeRequests = activeRequestsRef;
        return () => {
            isMounted.current = false;
            activeRequests.current.clear();
        };
    }, []);

    return { data, clientCounts, loading, error };
}
