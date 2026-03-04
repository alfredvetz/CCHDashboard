"use client";
import React, { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { formatCurrency, formatPeriodLabel } from "@/utils/format";
import { ExistingClientsBulkResponse } from "@/types/api";

interface RevenuePoint {
    bucket: string;
    total_revenue: number;
}

interface ChartDataPoint {
    bucket?: string;
    month?: string;
    date?: string;
}
interface Props {
    revenueData: RevenuePoint[];
    existingClientsData: ExistingClientsBulkResponse | null;
    loading?: boolean;
    viewAsHours?: boolean;
    onChartPointClick?: (data: ChartDataPoint) => void;
}

const BILLING_RATE = 70.22;

const CustomTooltip = ({
    active,
    payload,
    viewAsHours,
}: {
    active?: unknown;
    payload?: {
        payload: {
            bucket: string;
            previousMonthTotal: number;
            newRevenue: number;
            lostRevenue: number;
            netNew: number;
            netNewVsLost: number;
            expansionRevenue: number;
            contractionRevenue: number;
            netExistingChange: number;
            netExisting: number;
            actualTotal: number;
        };
    }[];
    viewAsHours?: boolean;
}) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload || {};

    const fmt = (v: number) =>
        viewAsHours ? `${v.toFixed(1)}h` : formatCurrency(v);

    return (
        <div
            className="bg-white shadow-card border border-slate-100 p-3 rounded-xl text-slate-800 text-sm min-w-[220px]"
            style={{ opacity: 1 }}
        >
            <div className="font-semibold mb-2 text-base border-b pb-1">
                {formatPeriodLabel(row.bucket, "monthly")}
            </div>

            <div className="flex justify-between items-center py-0.5">
                <span className="flex items-center gap-2">
                    <span
                        className="w-3 h-0.5 inline-block"
                        style={{ backgroundColor: "#2d75af" }}
                    ></span>
                    Previous Month:
                </span>
                <span className="font-medium">
                    {fmt(row.previousMonthTotal)}
                </span>
            </div>

            <div
                className="mt-2 pl-2 ml-1"
                style={{ borderLeft: "2px solid #CC4C33" }}
            >
                <div className="text-xs text-muted-foreground mb-1">
                    Net New vs Lost:
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-green-600">+ New Clients:</span>
                    <span>{fmt(row.newRevenue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-red-600">− Lost Clients:</span>
                    <span>{fmt(row.lostRevenue)}</span>
                </div>
                <div className="flex justify-between font-medium border-t mt-1 pt-1">
                    <span>= Net New:</span>
                    <span
                        className={
                            row.netNew >= 0 ? "text-green-600" : "text-red-600"
                        }
                    >
                        {row.netNew >= 0 ? "+" : ""}
                        {fmt(row.netNew)}
                    </span>
                </div>
            </div>

            <div className="flex justify-between items-center py-0.5 mt-1">
                <span className="flex items-center gap-2">
                    <span
                        className="w-3 h-0.5 inline-block"
                        style={{ backgroundColor: "#CC4C33" }}
                    ></span>
                    After Net New:
                </span>
                <span className="font-medium">{fmt(row.netNewVsLost)}</span>
            </div>

            <div
                className="mt-2 pl-2 ml-1"
                style={{ borderLeft: "2px solid #36A150" }}
            >
                <div className="text-xs text-muted-foreground mb-1">
                    Net Existing:
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-green-600">+ Expansion:</span>
                    <span>{fmt(row.expansionRevenue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-red-600">− Contraction:</span>
                    <span>{fmt(row.contractionRevenue)}</span>
                </div>
                <div className="flex justify-between font-medium border-t mt-1 pt-1">
                    <span>= Net Existing:</span>
                    <span
                        className={
                            row.netExistingChange >= 0
                                ? "text-green-600"
                                : "text-red-600"
                        }
                    >
                        {row.netExistingChange >= 0 ? "+" : ""}
                        {fmt(row.netExistingChange)}
                    </span>
                </div>
            </div>

            <div className="flex justify-between items-center py-0.5 mt-1">
                <span className="flex items-center gap-2">
                    <span
                        className="w-3 h-0.5 inline-block"
                        style={{ backgroundColor: "#36A150" }}
                    ></span>
                    Current Total:
                </span>
                <span className="font-medium">{fmt(row.netExisting)}</span>
            </div>

            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                <div className="flex justify-between">
                    <span>Actual Total (verify):</span>
                    <span>{fmt(row.actualTotal)}</span>
                </div>
            </div>
        </div>
    );
};

export default function RevenueBreakdownChart({
    viewAsHours,
    revenueData,
    existingClientsData,
    loading,
    onChartPointClick,
}: Props) {
    const chartData = useMemo(() => {
        if (!revenueData || revenueData.length === 0) return [];
        if (!existingClientsData?.data || existingClientsData.data.length === 0)
            return [];
        const normalizeYm = (s: string) => s?.slice(0, 7) || s;
        const sortedRevenue = [...revenueData].sort((a, b) =>
            normalizeYm(a.bucket).localeCompare(normalizeYm(b.bucket)),
        );

        const clientsByMonth = new Map<string, Map<string, number>>();
        existingClientsData.data.forEach((monthData) => {
            const ym = normalizeYm(monthData.ref_month);
            const clientMap = new Map<string, number>();
            monthData.data.forEach((client) => {
                const revenue = Number(client.monthly_revenue) || 0;
                if (revenue > 0) {
                    clientMap.set(client.client_name, revenue);
                }
            });
            clientsByMonth.set(ym, clientMap);
        });
        const toUnits = (value: number) =>
            viewAsHours ? value / BILLING_RATE : value;

        const points = sortedRevenue.map((point, idx) => {
            const ym = normalizeYm(point.bucket);
            const currentTotal = Number(point.total_revenue || 0);

            const currentClients =
                clientsByMonth.get(ym) || new Map<string, number>();
            const [year, month] = ym.split("-").map(Number);
            const prevDate = new Date(year, month - 2, 1);
            const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
            const prevClients =
                clientsByMonth.get(prevYm) || new Map<string, number>();

            let prevTotal = 0;
            prevClients.forEach((revenue) => {
                prevTotal += revenue;
            });

            let newRevenue = 0;
            let lostRevenue = 0;
            let expansionRevenue = 0;
            let contractionRevenue = 0;

            currentClients.forEach((revenue, clientName) => {
                if (!prevClients.has(clientName)) {
                    newRevenue += revenue;
                }
            });

            prevClients.forEach((revenue, clientName) => {
                if (!currentClients.has(clientName)) {
                    lostRevenue += revenue;
                }
            });

            currentClients.forEach((currentRev, clientName) => {
                const prevRev = prevClients.get(clientName);
                if (prevRev !== undefined) {
                    const change = currentRev - prevRev;
                    if (change > 0) {
                        expansionRevenue += change;
                    } else if (change < 0) {
                        contractionRevenue += Math.abs(change);
                    }
                }
            });

            const previousMonthTotal = toUnits(prevTotal);
            const netNewVsLost = toUnits(prevTotal + newRevenue - lostRevenue);
            const netExisting = toUnits(
                prevTotal +
                    newRevenue -
                    lostRevenue +
                    expansionRevenue -
                    contractionRevenue,
            );

            const date = new Date(ym + "-01");
            const label = date.toLocaleDateString("en-AU", {
                month: "short",
                year: "2-digit",
            });

            return {
                bucket: ym,
                label,
                previousMonthTotal,
                netNewVsLost,
                netExisting,
                actualTotal: toUnits(currentTotal),
                newRevenue: toUnits(newRevenue),
                lostRevenue: toUnits(lostRevenue),
                expansionRevenue: toUnits(expansionRevenue),
                contractionRevenue: toUnits(contractionRevenue),
                netNew: toUnits(newRevenue - lostRevenue),
                netExistingChange: toUnits(
                    expansionRevenue - contractionRevenue,
                ),
            };
        });

        return points;
    }, [revenueData, existingClientsData, viewAsHours]);

    const { yMin, yMax } = useMemo(() => {
        if (chartData.length === 0) return { yMin: 0, yMax: 100 };

        let min = Infinity;
        let max = -Infinity;

        chartData.forEach((point) => {
            const values = [
                point.previousMonthTotal,
                point.netNewVsLost,
                point.netExisting,
                point.actualTotal,
            ];
            values.forEach((v) => {
                if (v < min) min = v;
                if (v > max) max = v;
            });
        });

        const padding = (max - min) * 0.1 || 10;
        return {
            yMin: Math.max(0, min - padding),
            yMax: max + padding,
        };
    }, [chartData]);

    if (loading) {
        return (
            <Card className="rounded-2xl border-slate-100">
                <CardHeader>
                    <CardTitle className="font-heading font-bold text-slate-800">
                        {viewAsHours ? "Hours Breakdown" : "Revenue Breakdown"}:
                        Previous Month + Net New + Net Existing
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="h-64 md:h-72 lg:h-80 min-h-64 flex items-center justify-center">
                        <div className="animate-pulse text-slate-500">
                            Loading chart data...
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (chartData.length === 0) {
        return (
            <Card className="rounded-2xl border-slate-100">
                <CardHeader>
                    <CardTitle className="font-heading font-bold text-slate-800">
                        {viewAsHours ? "Hours Breakdown" : "Revenue Breakdown"}:
                        Previous Month + Net New + Net Existing
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="h-64 md:h-72 lg:h-80 min-h-64 flex items-center justify-center text-slate-500">
                        No data available for the selected range
                    </div>
                </CardContent>
            </Card>
        );
    }
    return (
        <Card className="rounded-2xl border-slate-100">
            <CardHeader>
                <CardTitle className="font-heading font-bold text-slate-800 text-xl">
                    {viewAsHours ? "Hours Breakdown" : "Revenue Breakdown"}: Previous Month + Net New + Net Existing
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <div className="h-64 md:h-72 lg:h-80 min-h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            onClick={(state) => {
                                const activePayload =
                                    state?.activePayload?.[0]?.payload;
                                if (
                                    activePayload?.bucket &&
                                    onChartPointClick
                                ) {
                                    onChartPointClick(activePayload.bucket);
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
                                domain={[yMin, yMax]}
                                tickFormatter={(v) =>
                                    viewAsHours
                                        ? `${Number(v).toFixed(0)}h`
                                        : `$${Math.round(Number(v) / 1000)}k`
                                }
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                content={
                                    <CustomTooltip viewAsHours={viewAsHours} />
                                }
                                cursor={{
                                    stroke: "var(--muted-foreground)",
                                    strokeDasharray: "3 3",
                                }}
                            />
                            <Legend
                                verticalAlign="top"
                                height={36}
                                formatter={(value) => (
                                    <span className="text-sm">{value}</span>
                                )}
                            />
                            <Line
                                type="monotone"
                                dataKey="previousMonthTotal"
                                name="Previous Month Total"
                                stroke="#2d75af"
                                strokeWidth={1.5}
                                dot={{ r: 2, fill: "#2d75af" }}
                                activeDot={{ r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="netNewVsLost"
                                name="+ Net New vs Lost"
                                stroke="#CC4C33"
                                strokeWidth={1.5}
                                dot={{ r: 2, fill: "#CC4C33" }}
                                activeDot={{ r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="netExisting"
                                name="+ Net Existing (= Total)"
                                stroke="#36A150"
                                strokeWidth={1.5}
                                dot={{ r: 2, fill: "#36A150" }}
                                activeDot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                        <span>
                            <span
                                className="inline-block w-3 h-0.5 mr-1"
                                style={{ backgroundColor: "#2d75af" }}
                            ></span>{" "}
                            Previous Month = Last month&apos;s total
                        </span>
                        <span>
                            <span
                                className="inline-block w-3 h-0.5 mr-1"
                                style={{ backgroundColor: "#CC4C33" }}
                            ></span>{" "}
                            + Net New = New clients − Lost clients
                        </span>
                        <span>
                            <span
                                className="inline-block w-3 h-0.5 mr-1"
                                style={{ backgroundColor: "#36A150" }}
                            ></span>{" "}
                            + Net Existing = Expansion − Contraction ={" "}
                            <strong>Current Total</strong>
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
