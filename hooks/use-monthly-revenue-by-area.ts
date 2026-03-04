import { useEffect, useState, useMemo, useRef } from "react";
import { invokeFunction } from "@/utils/request";
import type {
    RevenueByAreaResponse,
    MonthlyAreaData,
    AggregatedAreaRevenue,
    AreaFilterParams,
} from "@/types/api";

export type { AggregatedAreaRevenue as RevenueByAreaRow, MonthlyAreaData };

export interface RevenueByAreaData extends RevenueByAreaResponse {
    rows?: AggregatedAreaRevenue[];
}

const activeRequests = new Set<string>();

function getAreaKey(area: AreaFilterParams["area"]): string {
    if (!area) return "all";
    if (Array.isArray(area)) return [...area].sort().join(",");
    return area;
}

/**
 * Consolidated hook that fetches revenue by area data and returns both:
 * 1. Aggregated totals (summed across all months) - for area filtering
 * 2. Monthly breakdown by area - for chart lines
 *
 * This eliminates duplicate API calls that were happening with separate hooks.
 */
export function useRevenueByArea(
    startDate: string,
    endDate: string,
    area?: AreaFilterParams["area"],
) {
    const [data, setData] = useState<AggregatedAreaRevenue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    const areaKey = useMemo(() => getAreaKey(area), [area]);

    useEffect(() => {
        const requestKey = `rev-by-area-${startDate}-${endDate}-${areaKey}`;

        if (activeRequests.has(requestKey)) {
            return;
        }

        activeRequests.add(requestKey);
        isMountedRef.current = true;

        const fetchRevenueByArea = async () => {
            if (isMountedRef.current) {
                setLoading(true);
                setError(null);
            }

            try {
                const json = await invokeFunction<RevenueByAreaData>(
                    "analytics/revenue-by-area",
                    {
                        method: "POST",
                        body: {
                            start_date: startDate,
                            end_date: endDate,
                            data: [],
                            ...(area ? { area } : {}),
                        },
                        cacheTtlMs: 1000,
                    },
                );

                let aggregatedRows: AggregatedAreaRevenue[] = [];

                if (json?.data && Array.isArray(json.data)) {
                    const areaMap = new Map<string, number>();

                    json.data.forEach((monthData: MonthlyAreaData) => {
                        if (monthData.areas && Array.isArray(monthData.areas)) {
                            monthData.areas.forEach((areaData) => {
                                const current = areaMap.get(areaData.area) || 0;
                                areaMap.set(
                                    areaData.area,
                                    current + areaData.total_revenue,
                                );
                            });
                        }
                    });

                    aggregatedRows = Array.from(areaMap.entries()).map(
                        ([areaName, total]) => ({
                            area: areaName,
                            total_revenue: total.toString(),
                        }),
                    );
                } else if (json.rows && Array.isArray(json.rows)) {
                    aggregatedRows = json.rows.map((row) => ({
                        area: row.area,
                        total_revenue:
                            typeof row.total_revenue === "string"
                                ? row.total_revenue
                                : String(row.total_revenue),
                    }));
                } else {
                    console.warn(
                        "useRevenueByArea: Unexpected response format:",
                        json,
                    );
                    aggregatedRows = [];
                }

                if (isMountedRef.current) {
                    setData(aggregatedRows);
                }
            } catch (e) {
                if (isMountedRef.current) {
                    setError(
                        e instanceof Error
                            ? e.message
                            : "Failed to fetch revenue by area data",
                    );
                }
            } finally {
                if (isMountedRef.current) {
                    setLoading(false);
                }
                activeRequests.delete(requestKey);
            }
        };

        fetchRevenueByArea();

        return () => {
            activeRequests.delete(requestKey);
        };
    }, [startDate, endDate, areaKey, area]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return { data, loading, error };
}

/**
 * Consolidated hook that fetches monthly revenue by area data.
 * Returns both aggregated totals AND monthly breakdown in a single API call.
 *
 * @param startMonth - Format: "YYYY-MM" (e.g., "2025-01")
 * @param endMonth - Format: "YYYY-MM" (e.g., "2025-10")
 * @param area - Optional area filter (single string or array of strings)
 * @returns Object containing:
 *   - monthlyData: { [yearMonth]: AggregatedAreaRevenue[] } - Monthly breakdown by area
 *   - aggregatedData: AggregatedAreaRevenue[] - Aggregated totals across all months
 *   - monthlyLoading: { [yearMonth]: boolean } - Loading state per month
 *   - monthlyError: { [yearMonth]: string | null } - Error state per month
 *   - loading: boolean - Overall loading state
 *   - error: string | null - Overall error state
 */
export function useMonthlyRevenueByArea(
    startMonth: string,
    endMonth: string,
    area?: AreaFilterParams["area"],
) {
    const [monthlyData, setMonthlyData] = useState<{
        [key: string]: AggregatedAreaRevenue[];
    }>({});
    const [aggregatedData, setAggregatedData] = useState<
        AggregatedAreaRevenue[]
    >([]);
    const [monthlyLoading, setMonthlyLoading] = useState<{
        [key: string]: boolean;
    }>({});
    const [monthlyError, setMonthlyError] = useState<{
        [key: string]: string | null;
    }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    // Memoize the area key to prevent unnecessary re-renders
    const areaKey = useMemo(() => getAreaKey(area), [area]);

    // Generate list of months between startMonth and endMonth
    const monthRange = useMemo(() => {
        const months: string[] = [];
        const [startYear, startMonthNum] = startMonth.split("-").map(Number);
        const [endYear, endMonthNum] = endMonth.split("-").map(Number);

        let currentYear = startYear;
        let currentMonth = startMonthNum;

        while (
            currentYear < endYear ||
            (currentYear === endYear && currentMonth <= endMonthNum)
        ) {
            const monthStr = currentMonth.toString().padStart(2, "0");
            months.push(`${currentYear}-${monthStr}`);

            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        return months;
    }, [startMonth, endMonth]);

    // Convert yearMonth (e.g., "2025-01") to start and end dates for the range
    const dateRange = useMemo(() => {
        if (!startMonth || !endMonth) return null;

        const [startYear, startMonthNum] = startMonth.split("-").map(Number);
        const [endYear, endMonthNum] = endMonth.split("-").map(Number);

        const startDate = new Date(Date.UTC(startYear, startMonthNum - 1, 1))
            .toISOString()
            .slice(0, 10);
        // End date should be the first day of the month after endMonth
        const endDate = new Date(Date.UTC(endYear, endMonthNum, 1))
            .toISOString()
            .slice(0, 10);

        return { startDate, endDate };
    }, [startMonth, endMonth]);

    // Fetch data for all months in a single API call
    useEffect(() => {
        if (!startMonth || !endMonth || !dateRange) return;

        const requestKey = `monthly-rev-by-area-${dateRange.startDate}-${dateRange.endDate}-${areaKey}`;

        // If this exact request is already in progress, don't make another one
        if (activeRequests.has(requestKey)) {
            return;
        }

        activeRequests.add(requestKey);
        isMountedRef.current = true;

        const fetchAllMonthsData = async () => {
            if (isMountedRef.current) {
                setIsLoading(true);
                setError(null);
            }

            // Initialize loading states for all months
            const initialLoading: { [key: string]: boolean } = {};
            const initialData: { [key: string]: AggregatedAreaRevenue[] } = {};
            const initialError: { [key: string]: string | null } = {};

            monthRange.forEach((month) => {
                initialLoading[month] = true;
                initialData[month] = [];
                initialError[month] = null;
            });

            if (isMountedRef.current) {
                setMonthlyLoading(initialLoading);
                setMonthlyData(initialData);
                setMonthlyError(initialError);
                // Reset aggregated data while loading new data to prevent mixing states
                setAggregatedData([]);
            }

            try {
                const json = await invokeFunction<RevenueByAreaData>(
                    "analytics/revenue-by-area",
                    {
                        method: "POST",
                        body: {
                            start_date: dateRange.startDate,
                            end_date: dateRange.endDate,
                            data: [],
                            ...(area ? { area } : {}),
                        },
                        cacheTtlMs: 1000,
                    },
                );

                let monthlyDataArray: MonthlyAreaData[] = [];

                if (json?.data && Array.isArray(json.data)) {
                    monthlyDataArray = json.data;
                } else if (json.rows && Array.isArray(json.rows)) {
                    console.warn(
                        `useMonthlyRevenueByArea: Old format detected - edge function needs to be updated to new format`,
                    );
                    monthlyDataArray = [];
                } else {
                    console.warn(
                        `useMonthlyRevenueByArea: No response data received or unexpected format`,
                    );
                    monthlyDataArray = [];
                }

                const transformedData: {
                    [key: string]: AggregatedAreaRevenue[];
                } = {};
                const transformedLoading: { [key: string]: boolean } = {};
                const transformedError: { [key: string]: string | null } = {};
                const areaMap = new Map<string, number>();

                monthRange.forEach((month) => {
                    transformedLoading[month] = false;
                    transformedError[month] = null;
                    transformedData[month] = [];
                });

                if (monthlyDataArray.length > 0) {
                    monthlyDataArray.forEach((monthData) => {
                        try {
                            const monthKey = monthData.month.substring(0, 7);

                            if (monthRange.includes(monthKey)) {
                                if (
                                    !monthData.areas ||
                                    !Array.isArray(monthData.areas)
                                ) {
                                    transformedError[monthKey] =
                                        "Invalid data format for this month";
                                    return;
                                }

                                transformedData[monthKey] = monthData.areas.map(
                                    (a) => {
                                        if (
                                            !a ||
                                            typeof a.area !== "string" ||
                                            typeof a.total_revenue !== "number"
                                        ) {
                                            throw new Error(
                                                `Invalid area data: ${JSON.stringify(a)}`,
                                            );
                                        }

                                        const current =
                                            areaMap.get(a.area) || 0;
                                        areaMap.set(
                                            a.area,
                                            current + a.total_revenue,
                                        );

                                        return {
                                            area: a.area,
                                            total_revenue:
                                                a.total_revenue.toString(),
                                        };
                                    },
                                );

                                transformedLoading[monthKey] = false;
                                transformedError[monthKey] = null;
                            }
                        } catch (e) {
                            console.error(
                                `useMonthlyRevenueByArea: Error processing month data:`,
                                e,
                                monthData,
                            );
                            const monthKey =
                                monthData.month?.substring(0, 7) || "unknown";
                            transformedError[monthKey] =
                                `Error processing data: ${e instanceof Error ? e.message : "Unknown error"}`;
                        }
                    });
                }

                const aggregatedRows: AggregatedAreaRevenue[] = Array.from(
                    areaMap.entries(),
                ).map(([areaName, total]) => ({
                    area: areaName,
                    total_revenue: total.toString(),
                }));

                if (isMountedRef.current) {
                    setMonthlyData(transformedData);
                    setAggregatedData(aggregatedRows);
                    setMonthlyLoading(transformedLoading);
                    setMonthlyError(transformedError);
                }
            } catch (e) {
                const errorMessage =
                    e instanceof Error
                        ? e.message
                        : "Failed to fetch revenue by area data";
                console.error(
                    `useMonthlyRevenueByArea: Error fetching data:`,
                    e,
                );

                if (isMountedRef.current) {
                    setError(errorMessage);

                    const errorState: { [key: string]: string | null } = {};
                    monthRange.forEach((month) => {
                        errorState[month] = errorMessage;
                    });
                    setMonthlyError(errorState);

                    const loadingState: { [key: string]: boolean } = {};
                    monthRange.forEach((month) => {
                        loadingState[month] = false;
                    });
                    setMonthlyLoading(loadingState);
                }
            } finally {
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
                activeRequests.delete(requestKey);
            }
        };

        fetchAllMonthsData();

        return () => {
            activeRequests.delete(requestKey);
        };
    }, [startMonth, endMonth, dateRange, monthRange, areaKey, area]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return {
        monthlyData,
        aggregatedData,
        monthlyLoading,
        monthlyError,
        monthRange,
        loading: isLoading,
        error,
    };
}

export function useRevenueByAreaForMonth(
    yearMonth: string,
    area?: AreaFilterParams["area"],
) {
    const [data, setData] = useState<AggregatedAreaRevenue[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    const areaKey = useMemo(() => getAreaKey(area), [area]);

    useEffect(() => {
        if (!yearMonth) return;

        const requestKey = `rev-by-area-month-${yearMonth}-${areaKey}`;

        if (activeRequests.has(requestKey)) {
            return;
        }

        activeRequests.add(requestKey);
        isMountedRef.current = true;

        const fetchRevenueByAreaForMonth = async () => {
            if (isMountedRef.current) {
                setLoading(true);
                setError(null);
            }

            try {
                const [year, month] = yearMonth.split("-").map(Number);
                const startDate = new Date(Date.UTC(year, month - 1, 1))
                    .toISOString()
                    .slice(0, 10);
                const endDate = new Date(Date.UTC(year, month, 1))
                    .toISOString()
                    .slice(0, 10);

                const json = await invokeFunction<RevenueByAreaData>(
                    "analytics/revenue-by-area",
                    {
                        method: "POST",
                        body: {
                            start_date: startDate,
                            end_date: endDate,
                            data: [],
                            ...(area ? { area } : {}),
                        },
                        cacheTtlMs: 1000,
                    },
                );

                const monthKey = `${year}-${String(month).padStart(2, "0")}-01`;
                const monthData = json?.data?.find(
                    (m) =>
                        m.month === monthKey ||
                        m.month.startsWith(
                            `${year}-${String(month).padStart(2, "0")}`,
                        ),
                );

                const rows: AggregatedAreaRevenue[] =
                    monthData?.areas.map((a) => ({
                        area: a.area,
                        total_revenue: a.total_revenue.toString(),
                    })) || [];

                if (isMountedRef.current) {
                    setData(rows);
                }
            } catch (e) {
                if (isMountedRef.current) {
                    setError(
                        e instanceof Error
                            ? e.message
                            : "Failed to fetch revenue by area data",
                    );
                }
            } finally {
                if (isMountedRef.current) {
                    setLoading(false);
                }
                activeRequests.delete(requestKey);
            }
        };

        fetchRevenueByAreaForMonth();

        return () => {
            activeRequests.delete(requestKey);
        };
    }, [yearMonth, areaKey, area]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return { data, loading, error };
}
