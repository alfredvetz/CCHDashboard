"use client";

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Clock } from "lucide-react";
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import { useState, useMemo } from "react";
import { formatCurrency, formatPeriodLabel } from "../../../../utils/format";
import { Period } from "../../../../types/dashboard.types";
import { MonthlyClientPanel } from "./monthly-client-panel";
import type { MonthlyClientMetrics } from "@/hooks/use-client-metrics";

const BILLING_RATE = 70.22;

interface NewClientApiItem {
    month_start?: string;
    client_key: string;
    client_uid?: number;
    client_name: string;
    area?: string | null;
    monthly_revenue?: number;
}

/** Raw API item from lost_clients.data */
interface LostClientApiItem {
    client_key: string;
    client_uid?: number | null;
    client_name: string;
    area?: string | null;
    rev_1_month_ago?: number;
    monthly_revenue?: number;
}

interface ClientMovementDetail {
    ref_month?: string;
    new_clients?: { data: NewClientApiItem[] };
    lost_clients?: { data: LostClientApiItem[] };
}

interface NewVsLostChartDataPoint {
    bucket: string;
    label: string;
    revenue_increases?: number;
    revenue_decreases?: number;
    net_change?: number;
    new_count?: number;
    lost_count?: number;
    new_revenue?: number;
    lost_revenue?: number;
    new_client_names?: string[];
    lost_client_names?: string[];
}

interface NewVsLostProps {
    clientMetrics: MonthlyClientMetrics[];
    getMonthMetrics: (month: string) => MonthlyClientMetrics | undefined;
    period: Period;
    selectedAreas: string[];
    loading?: boolean;
    startMonth?: string;
    endMonth?: string;
    onChartPointClick?: (dataPoint: NewVsLostChartDataPoint) => void;
    viewAsHours?: boolean;
    areas?: { UUID: string; Area: string }[];
}

function ClientDetailModal({
    isOpen,
    onClose,
    bucket,
    period,
    newClientNames,
    lostClientNames,
}: {
    isOpen: boolean;
    onClose: () => void;
    bucket: string | null;
    period: Period;
    newClientNames: string[];
    lostClientNames: string[];
}) {
    if (!bucket) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white rounded-2xl border-slate-100 shadow-card sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle className="font-heading font-bold text-slate-800 text-xl">
                        Client Movements for {formatPeriodLabel(bucket, period)}
                    </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="new" className="pt-2">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="new">
                            New Clients ({newClientNames.length})
                        </TabsTrigger>
                        <TabsTrigger value="lost">
                            Lost Clients ({lostClientNames.length})
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="new">
                        <ul className="py-2 max-h-64 overflow-y-auto">
                            {newClientNames.length === 0 ? (
                                <li className="text-muted-foreground">
                                    No new clients in this period.
                                </li>
                            ) : (
                                newClientNames.map((name, i) => (
                                    <li
                                        key={i}
                                        className="border-b border-slate-100 py-2 last:border-b-0 text-slate-600 font-medium"
                                    >
                                        {name}
                                    </li>
                                ))
                            )}
                        </ul>
                    </TabsContent>
                    <TabsContent value="lost">
                        <ul className="py-2 max-h-64 overflow-y-auto">
                            {lostClientNames.length === 0 ? (
                                <li className="text-slate-500 font-medium">
                                    No lost clients in this period.
                                </li>
                            ) : (
                                lostClientNames.map((name, i) => (
                                    <li
                                        key={i}
                                        className="border-b border-slate-100 py-2 last:border-b-0 text-slate-600 font-medium"
                                    >
                                        {name}
                                    </li>
                                ))
                            )}
                        </ul>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

interface NewVsLostTooltipProps {
    active?: boolean;
    payload?: Array<{ payload?: NewVsLostChartDataPoint }>;
    label?: string;
    period: Period;
    viewAsHours?: boolean;
}

function NewVsLostCustomTooltip({
    active,
    payload,
    label,
    period,
    viewAsHours,
}: NewVsLostTooltipProps) {
    const dataPoint = payload?.[0]?.payload;
    if (active && dataPoint) {
        const newVal = Math.abs(dataPoint.revenue_increases ?? 0);
        const lostVal = Math.abs(dataPoint.revenue_decreases || 0);
        const netVal = dataPoint.net_change || 0;

        return (
            <div
                className="bg-white shadow-lg border p-3 rounded-lg text-gray-900 text-sm"
                style={{ opacity: 1 }}
            >
                <p className="font-bold mb-2">
                    {formatPeriodLabel(label ?? "", period)}
                </p>
                <div className="space-y-1">
                    <p className="text-green-600">
                        + New ({dataPoint.new_count}):{" "}
                        {viewAsHours
                            ? `${newVal.toFixed(1)}h`
                            : formatCurrency(newVal * BILLING_RATE)}
                    </p>
                    <p className="text-red-600">
                        − Lost ({dataPoint.lost_count}):{" "}
                        {viewAsHours
                            ? `${lostVal.toFixed(1)}h`
                            : formatCurrency(lostVal * BILLING_RATE)}
                    </p>
                    <p
                        className={`font-semibold pt-1 border-t border-border mt-1 ${netVal >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                        = Net:{" "}
                        {viewAsHours
                            ? `${netVal >= 0 ? "+" : ""}${netVal.toFixed(1)}h`
                            : formatCurrency(netVal * BILLING_RATE)}
                    </p>
                </div>
            </div>
        );
    }
    return null;
}

export function NewVsLost({
    clientMetrics,
    getMonthMetrics,
    period,
    selectedAreas,
    loading,
    startMonth,
    endMonth,
    onChartPointClick,
    viewAsHours,
    areas = [],
}: NewVsLostProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
    const [modalNewNames, setModalNewNames] = useState<string[]>([]);
    const [modalLostNames, setModalLostNames] = useState<string[]>([]);

    // Convert metrics to chart data format
    const chartData = useMemo(() => {
        if (!clientMetrics || clientMetrics.length === 0) return [];

        return clientMetrics.map((m) => {
            // Convert revenue to hours for display
            const newHours = m.newClientsRevenue / BILLING_RATE;
            const lostHours = m.lostClientsRevenue / BILLING_RATE;
            const netHours =
                (m.newClientsRevenue - m.lostClientsRevenue) / BILLING_RATE;

            return {
                bucket: m.month,
                label: m.label,
                // For chart bars (hours)
                revenue_increases: newHours,
                revenue_decreases: -lostHours, // Negative for downward bar
                net_change: netHours,
                // Counts
                new_count: m.newClientsCount,
                lost_count: m.lostClientsCount,
                // Raw revenue values
                new_revenue: m.newClientsRevenue,
                lost_revenue: m.lostClientsRevenue,
                // Client names for modal
                new_client_names: m.newClients.map((c) => c.client_name),
                lost_client_names: m.lostClients.map((c) => c.client_name),
            };
        });
    }, [clientMetrics]);

    // Adapter function to convert new metrics format to old MonthlyClientPanel format
    const getMonthData = useMemo(() => {
        return (refMonth: string): ClientMovementDetail | null => {
            const metrics = getMonthMetrics(refMonth);
            if (!metrics) return null;

            // Convert to the format expected by MonthlyClientPanel
            return {
                ref_month: refMonth,
                new_clients: {
                    data: metrics.newClients.map((c) => ({
                        client_key: c.client_name,
                        client_name: c.client_name,
                        area: c.area || "N/A",
                        monthly_revenue: c.monthly_revenue,
                    })),
                },
                lost_clients: {
                    data: metrics.lostClients.map((c) => ({
                        client_key: c.client_name,
                        client_name: c.client_name,
                        area: c.area || "N/A",
                        monthly_revenue: 0, // They have 0 this month
                        rev_1_month_ago: c.prev_revenue || 0, // Their revenue from last month
                    })),
                },
            };
        };
    }, [getMonthMetrics]);

    // Convert metrics array to format expected by MonthlyClientPanel
    const clientMovementDetails = useMemo(() => {
        return clientMetrics
            .map((m) => getMonthData(m.month))
            .filter(Boolean) as unknown as ClientMovementDetail[];
    }, [clientMetrics, getMonthData]) as ClientMovementDetail[];

    const handleChartClick = (e: {
        activePayload?: { payload: NewVsLostChartDataPoint }[];
    }) => {
        if (e?.activePayload && e.activePayload.length > 0) {
            const payload = e.activePayload[0].payload;
            if (onChartPointClick) {
                onChartPointClick(payload);
            }
            // Set up modal data
            setSelectedBucket(payload.bucket);
            setModalNewNames(payload.new_client_names || []);
            setModalLostNames(payload.lost_client_names || []);
            setIsModalOpen(true);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 bg-slate-100 rounded w-1/3 animate-pulse"></div>
                <Card className="rounded-2xl border-slate-100 animate-pulse h-96">
                    <CardHeader>
                        <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-full bg-slate-100 rounded"></div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="w-full rounded-2xl border-slate-100">
                <CardHeader>
                    <CardTitle className="font-heading font-bold text-slate-800 text-xl flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            {viewAsHours ? (
                                <Clock className="size-5" />
                            ) : (
                                <Users className="size-5" />
                            )}
                        </span>
                        New vs Lost Client {viewAsHours ? "Hours" : "Revenue"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                    <div className="h-64 md:h-72 lg:h-80 min-h-64">
                        {chartData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-500 font-medium">
                                No data available for the selected range
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={chartData}
                                    margin={{
                                        top: 20,
                                        right: 30,
                                        left: 20,
                                        bottom: 5,
                                    }}
                                    onClick={handleChartClick}
                                >
                                    <CartesianGrid
                                        stroke="var(--border)"
                                        strokeDasharray="3 3"
                                    />
                                    <XAxis
                                        dataKey="bucket"
                                        tickFormatter={(label) =>
                                            formatPeriodLabel(label, period)
                                        }
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
                                        tickFormatter={(val) =>
                                            `${Number(val).toFixed(0)}h`
                                        }
                                    />
                                    <Tooltip
                                        content={(props) => (
                                            <NewVsLostCustomTooltip
                                                {...props}
                                                period={period}
                                                viewAsHours={viewAsHours}
                                            />
                                        )}
                                        cursor={{
                                            stroke: "var(--muted-foreground)",
                                            strokeDasharray: "3 3",
                                        }}
                                    />
                                    <ReferenceLine
                                        y={0}
                                        stroke="var(--border)"
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                    />

                                    {/* New Clients Bar (positive) */}
                                    <Bar
                                        dataKey="revenue_increases"
                                        fill="#7AB1DD"
                                        name={
                                            viewAsHours
                                                ? "New Clients Hours"
                                                : "New Clients Revenue"
                                        }
                                        radius={[4, 4, 0, 0]}
                                    />

                                    {/* Lost Clients Bar (negative) */}
                                    <Bar
                                        dataKey="revenue_decreases"
                                        fill="#AACDE9"
                                        name={
                                            viewAsHours
                                                ? "Lost Clients Hours"
                                                : "Lost Clients Revenue"
                                        }
                                        radius={[0, 0, 4, 4]}
                                    />

                                    {/* Net change line */}
                                    <Line
                                        type="monotone"
                                        dataKey="net_change"
                                        stroke="#36A150"
                                        strokeWidth={2}
                                        dot={{
                                            fill: "#36A150",
                                            strokeWidth: 2,
                                            r: 4,
                                        }}
                                        name={
                                            viewAsHours
                                                ? "Net Hours Change"
                                                : "Net Revenue Change"
                                        }
                                        connectNulls={false}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    {startMonth && endMonth && (
                        <MonthlyClientPanel
                            startMonth={startMonth}
                            endMonth={endMonth}
                            initialMonth={endMonth}
                            viewAsHours={viewAsHours}
                            clientMovementDetails={clientMovementDetails}
                            getMonthData={getMonthData}
                            areas={areas}
                        />
                    )}
                </CardContent>
            </Card>

            <ClientDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                bucket={selectedBucket}
                period={period}
                newClientNames={modalNewNames}
                lostClientNames={modalLostNames}
            />
        </div>
    );
}
