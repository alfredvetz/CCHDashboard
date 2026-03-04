import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    TooltipProps,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "../../../../utils/format";
import { useState, useMemo } from "react";
import type { AggregatedAreaRevenue } from "@/types/api";

interface ChartProps {
    loading: boolean;
}

interface RevenueByAreaProps extends ChartProps {
    /** Aggregated revenue data by area */
    data: { area: string; revenue: number }[];
    /** Start month in YYYY-MM format */
    startMonth: string;
    /** End month in YYYY-MM format */
    endMonth: string;
    /** Monthly breakdown data keyed by YYYY-MM */
    monthlyData: { [key: string]: AggregatedAreaRevenue[] };
    /** Loading state per month */
    monthlyLoading: { [key: string]: boolean };
    /** Callback when a chart point is clicked */
    onChartPointClick?: (dataPoint: {
        month: string;
        label: string;
        [area: string]: number | string;
    }) => void;
    /** Display values as hours instead of revenue */
    viewAsHours?: boolean;
    /** Currently selected areas from global filter */
    selectedAreas?: string[];
    /** All available areas for filtering */
    availableAreas?: string[];
    /** Whether showing community breakdown (when area filter is active) */
    isCommunityView?: boolean;
}

type ChartDataItem = { area: string; revenue: number; fill: string };

type TimeSeriesPoint = {
    month: string;
    label: string;
    [area: string]: string | number;
};

const CHART_COLORS = [
    "#2d75af", // blue
    "#CC4C33", // red
    "#36A150", // green
    "#e8b95d", // yellow
    "#8b5cf6", // purple
    "#1f77b4", // tableau blue
    "#ff7f0e", // orange
    "#2ca02c", // green 2
    "#d62728", // red 2
    "#9467bd", // purple 2
    "#8c564b", // brown
    "#e377c2", // pink
    "#7f7f7f", // gray
    "#bcbd22", // lime
    "#17becf", // cyan
    "#6b8e23", // olive
    "#00a6ed", // sky
    "#cb6e17", // burnt orange
    "#4daf4a", // green 3
    "#984ea3", // purple 3
    "#ffb6c1", // light pink
    "#a6cee3", // light blue
    "#fb9a99", // salmon
    "#b2df8a", // light green
];

function hexToRgba(hex: string, alpha: number): string {
    const sanitized = hex.replace("#", "");
    const bigint = parseInt(
        sanitized.length === 3
            ? sanitized
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : sanitized,
        16,
    );
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
        g = 0,
        b = 0;
    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else {
        r = c;
        g = 0;
        b = x;
    }
    const toHex = (v: number) =>
        Math.round((v + m) * 255)
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildAreaColorMap(areas: string[]): Record<string, string> {
    // Use dashboard chart colors (shades of blue) for consistency
    const sorted = [...areas].sort((a, b) => a.localeCompare(b));
    const map: Record<string, string> = {};
    sorted.forEach((area, i) => {
        // Cycle through CHART_COLORS array, using modulo to repeat if needed
        map[area] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
}

// Helper function to generate month labels
function generateMonthLabels(
    startMonth: string,
    endMonth: string,
): { value: string; label: string }[] {
    const months: { value: string; label: string }[] = [];
    const [startYear, startMonthNum] = startMonth.split("-").map(Number);
    const [endYear, endMonthNum] = endMonth.split("-").map(Number);

    let currentYear = startYear;
    let currentMonth = startMonthNum;

    while (
        currentYear < endYear ||
        (currentYear === endYear && currentMonth <= endMonthNum)
    ) {
        const monthStr = currentMonth.toString().padStart(2, "0");
        const yearMonth = `${currentYear}-${monthStr}`;

        const date = new Date(currentYear, currentMonth - 1, 1);
        const monthLabel = date.toLocaleDateString("en-AU", {
            month: "short",
            year: "2-digit",
        });

        months.push({ value: yearMonth, label: monthLabel });

        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }

    return months;
}

const BILLING_RATE = 70.22;

// Custom tooltip that filters out zero values when viewing as hours and filters by allowed areas
const CustomTooltip = ({
    active,
    payload,
    label,
    viewAsHours,
    allowedAreas,
}: TooltipProps<number, string> & {
    viewAsHours?: boolean;
    allowedAreas?: string[];
}) => {
    if (!active || !payload || payload.length === 0) return null;

    // Filter by allowed areas first (from selectedAreas filter)
    let filteredPayload =
        allowedAreas && allowedAreas.length > 0
            ? payload.filter((item) => {
                  const areaName = item.name || item.dataKey;
                  return allowedAreas.includes(String(areaName));
              })
            : payload;

    // Filter out zero values when viewing as hours
    if (viewAsHours) {
        filteredPayload = filteredPayload.filter((item) => {
            const value = Number(item.value || 0);
            return value > 0;
        });
    }

    if (filteredPayload.length === 0) return null;

    return (
        <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm shadow-card min-w-[180px] text-slate-800">
            <div className="font-semibold mb-2 text-slate-800">{label}</div>
            {filteredPayload.map((item, idx) => {
                const value = Number(item.value || 0);
                const formattedValue = viewAsHours
                    ? `${value.toFixed(1)}h`
                    : formatCurrency(value);
                return (
                    <div key={idx} className="flex items-center gap-2">
                        <span
                            className="inline-block h-2 w-2 rounded-sm shrink-0"
                            style={{ background: item.color || "#94a3b8" }}
                        />
                        <span className="text-slate-500 font-medium">
                            {item.name}:
                        </span>
                        <span className="tabular-nums font-semibold text-slate-800">
                            {formattedValue}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export function RevenueByAreaChart({
    data,
    loading,
    startMonth,
    endMonth,
    monthlyData,
    monthlyLoading,
    onChartPointClick,
    viewAsHours,
    selectedAreas = [],
    availableAreas = [],
    isCommunityView = false,
}: RevenueByAreaProps) {
    const monthLabels = useMemo(
        () => generateMonthLabels(startMonth, endMonth),
        [startMonth, endMonth],
    );

    // Determine loading state across months
    const isLoading = useMemo(() => {
        if (loading) return true;
        return monthLabels.some((m) => monthlyLoading[m.value]);
    }, [loading, monthlyLoading, monthLabels]);

    // Get all areas from data prop and compute top areas for chart display
    const { allAreas, topAreas, timeSeriesData } = useMemo(() => {
        const months = monthLabels.map((m) => m.value);

        type MonthlyRow = AggregatedAreaRevenue & { revenue?: number | string | null };

        // Get all unique areas from the data prop
        const allAreasFromData = [...new Set(data.map((item) => item.area))];

        const areaTotals: Record<string, number> = {};
        months.forEach((ym) => {
            const rows: MonthlyRow[] = monthlyData[ym] || [];
            rows.forEach((row) => {
                const revenue = parseFloat(
                    row.total_revenue ?? row.revenue ?? 0,
                );
                const safeRevenue = isNaN(revenue) ? 0 : revenue;
                areaTotals[row.area] =
                    (areaTotals[row.area] || 0) + safeRevenue;
            });
        });

        // Filter out areas with zero totals when viewing as hours
        let areasToUse = viewAsHours
            ? Object.keys(areaTotals).filter((area) => {
                  const total = areaTotals[area] || 0;
                  return total > 0;
              })
            : allAreasFromData;

        // Filter by availableAreas if provided (only show areas available in the filter)
        if (availableAreas.length > 0) {
            areasToUse = areasToUse.filter((area) =>
                availableAreas.includes(area),
            );
        }

        // Filter by selectedAreas if provided (from global filter)
        const allAreas =
            selectedAreas.length > 0
                ? areasToUse.filter((area) => selectedAreas.includes(area))
                : areasToUse;

        const areasByTotal = Object.entries(areaTotals)
            .filter(([area]) => allAreas.includes(area))
            .sort((a, b) => b[1] - a[1])
            .map(([area]) => area);
        const topAreas = areasByTotal.slice(0, CHART_COLORS.length);

        const timeSeriesData: TimeSeriesPoint[] = months.map((ym) => {
            const rows: MonthlyRow[] = monthlyData[ym] || [];
            const byArea: Record<string, number> = {};
            rows.forEach((row) => {
                // Only include areas that are in allAreas (already filtered)
                if (allAreas.includes(row.area)) {
                    byArea[row.area] =
                        parseFloat(row.total_revenue ?? row.revenue ?? 0) || 0;
                }
            });
            const label = monthLabels.find((m) => m.value === ym)?.label || ym;
            const entry: TimeSeriesPoint = { month: ym, label };
            // Only add areas that are in the filtered allAreas list
            allAreas.forEach((area) => {
                entry[area] = byArea[area] || 0;
            });
            return entry;
        });

        return { allAreas, topAreas, timeSeriesData };
    }, [
        data,
        monthlyData,
        monthLabels,
        viewAsHours,
        selectedAreas,
        availableAreas,
    ]);

    // Stable color assignment per area
    const areaColorMap = useMemo(() => buildAreaColorMap(allAreas), [allAreas]);

    // Interactive filtering by clicking legend items (local state for legend toggling)
    const [legendSelectedAreas, setLegendSelectedAreas] = useState<string[]>(
        [],
    );
    const toggleArea = (area: string) => {
        setLegendSelectedAreas((prev) =>
            prev.includes(area)
                ? prev.filter((a) => a !== area)
                : [...prev, area],
        );
    };
    const visibleAreas = legendSelectedAreas.length
        ? legendSelectedAreas
        : allAreas;

    // Transform data to hours if viewAsHours is true
    const transformedData = useMemo(() => {
        if (!viewAsHours) return timeSeriesData;
        return timeSeriesData.map<TimeSeriesPoint>((point) => {
            const transformed: TimeSeriesPoint = { ...point };
            allAreas.forEach((area) => {
                if (transformed[area] !== undefined) {
                    const value = Number(transformed[area] || 0);
                    transformed[area] = value / BILLING_RATE;
                }
            });
            return transformed;
        });
    }, [timeSeriesData, viewAsHours, allAreas]);

    // Rescale Y-axis based on visible areas' max to keep focus
    const yMax = useMemo(() => {
        let max = 0;
        transformedData.forEach((point) => {
            visibleAreas.forEach((area) => {
                const v = Number(point[area] || 0);
                if (v > max) max = v;
            });
        });
        return max;
    }, [transformedData, visibleAreas]);

    if (isLoading) {
        return (
            <Card className="rounded-2xl border-slate-100">
                <CardHeader>
                    <CardTitle className="font-heading font-bold text-slate-800 text-xl">
                        Revenue by Area
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="h-[300px] flex items-center justify-center">
                        <div className="animate-pulse text-slate-500 font-medium">
                            Loading chart...
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const hasData = timeSeriesData.length > 0 && allAreas.length > 0;

    return (
        <Card className="rounded-2xl border-slate-100">
            <CardHeader>
                <CardTitle className="font-heading font-bold text-slate-800 text-xl leading-tight">
                    {viewAsHours
                        ? isCommunityView
                            ? "Hours by Community"
                            : "Hours by Area"
                        : isCommunityView
                          ? "Revenue by Community"
                          : "Revenue by Area"}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {hasData ? (
                    <div className="flex flex-col gap-4">
                        {/* Line chart over time */}
                        <div className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={transformedData}
                                    margin={{
                                        top: 10,
                                        right: 20,
                                        left: 60,
                                        bottom: 0,
                                    }}
                                    onClick={(e) => {
                                        if (
                                            e &&
                                            e.activePayload &&
                                            e.activePayload.length > 0
                                        ) {
                                            const payload =
                                                e.activePayload[0].payload;
                                            if (onChartPointClick) {
                                                onChartPointClick(payload);
                                            }
                                        }
                                    }}
                                >
                                    <CartesianGrid
                                        stroke="var(--border)"
                                        strokeDasharray="3 3"
                                    />
                                    <XAxis
                                        dataKey="label"
                                        stroke="var(--muted-foreground)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="var(--muted-foreground)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) =>
                                            viewAsHours
                                                ? `${Number(v).toFixed(1)}h`
                                                : `$${Math.round((v as number) / 1000)}k`
                                        }
                                        domain={[
                                            0,
                                            yMax
                                                ? Math.ceil(yMax * 1.1)
                                                : "auto",
                                        ]}
                                    />
                                    <Tooltip
                                        content={
                                            <CustomTooltip
                                                viewAsHours={viewAsHours}
                                                allowedAreas={allAreas}
                                            />
                                        }
                                    />
                                    {allAreas
                                        .filter((area) =>
                                            visibleAreas.includes(area),
                                        )
                                        .map((area) => {
                                            const color = areaColorMap[area];
                                            return (
                                                <Line
                                                    key={area}
                                                    type="monotone"
                                                    dataKey={area}
                                                    stroke={color}
                                                    strokeWidth={2}
                                                    dot={{
                                                        r: 2,
                                                        stroke: color,
                                                        fill: color,
                                                    }}
                                                    name={area}
                                                />
                                            );
                                        })}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Legend (click to filter areas) */}
                        <div className="flex justify-center">
                            <div
                                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2"
                                style={{
                                    marginLeft: "60px",
                                    maxWidth: "calc(100% - 60px)",
                                }}
                            >
                                {allAreas.map((area, index) => {
                                    const isActive =
                                        visibleAreas.includes(area);
                                    const color = areaColorMap[area];
                                    return (
                                        <Button
                                            key={area}
                                            type="button"
                                            variant="outline"
                                            onClick={() => toggleArea(area)}
                                            className="w-full justify-start gap-3 h-auto py-2 px-3 rounded-xl border-slate-200 hover:bg-blue-50/20 transition-colors"
                                            aria-pressed={isActive}
                                            title={area}
                                            style={
                                                isActive
                                                    ? {
                                                          borderColor: color,
                                                          backgroundColor:
                                                              hexToRgba(
                                                                  color,
                                                                  0.12,
                                                              ),
                                                      }
                                                    : undefined
                                            }
                                        >
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0"
                                                style={{
                                                    backgroundColor: color,
                                                }}
                                            />
                                            <span className="text-sm text-slate-600 truncate font-medium">
                                                {area}
                                            </span>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-500 font-medium">
                        No data available for selected range
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
