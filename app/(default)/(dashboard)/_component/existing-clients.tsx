import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users } from "lucide-react";
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
import { MonthlyExistingClientsPanel } from "./monthly-existing-clients-panel";
import type {
    MonthlyClientMetrics,
    ClientInfo,
} from "@/hooks/use-client-metrics";

const BILLING_RATE = 70.22;

interface ExistingClientsChartDataPoint {
    bucket: string;
    label?: string;
    revenue_increases?: number;
    revenue_decreases?: number;
    net_change?: number;
    increase_count?: number;
    decrease_count?: number;
    increase_total?: number;
    decrease_total?: number;
    net_revenue_change?: number;
}

interface ExistingClientsProps {
    clientMetrics: MonthlyClientMetrics[];
    getMonthMetrics: (month: string) => MonthlyClientMetrics | undefined;
    period: string;
    selectedAreas: string[];
    loading?: boolean;
    startMonth?: string;
    endMonth?: string;
    onChartPointClick?: (dataPoint: ExistingClientsChartDataPoint) => void;
    viewAsHours?: boolean;
    areas?: { UUID: string; Area: string }[];
}

/**
 * Modal for displaying client details
 */
function ExistingClientDetailModal({
    isOpen,
    onClose,
    bucket,
    period,
    increasedClients,
    decreasedClients,
    viewAsHours,
}: {
    isOpen: boolean;
    onClose: () => void;
    bucket: string | null;
    period: string;
    increasedClients: ClientInfo[];
    decreasedClients: ClientInfo[];
    viewAsHours?: boolean;
}) {
    const formatValue = (val: number) =>
        viewAsHours
            ? `${(val / BILLING_RATE).toFixed(1)}h`
            : formatCurrency(val);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="rounded-2xl border-slate-100 shadow-card sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle className="font-heading font-bold text-slate-800 text-xl">
                        Existing Client Changes for{" "}
                        {formatPeriodLabel(bucket || "", period)}
                    </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="increased">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="increased">
                            Increased ({increasedClients.length})
                        </TabsTrigger>
                        <TabsTrigger value="decreased">
                            Decreased ({decreasedClients.length})
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="increased">
                        <div className="max-h-96 overflow-y-auto mt-4">
                            {increasedClients.length === 0 ? (
                                <div className="text-center text-slate-500 font-medium py-12">
                                    No clients with increased revenue in this
                                    period.
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-slate-50/30">
                                        <tr className="border-b border-slate-100">
                                            <th className="text-left py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                                                Client Name
                                            </th>
                                            <th className="text-left py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                                                Area
                                            </th>
                                            <th className="text-right py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                                                Change
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {increasedClients.map((client, i) => (
                                            <tr
                                                key={i}
                                                className="border-b border-slate-50 last:border-0"
                                            >
                                                <td className="py-2 font-medium text-slate-800">
                                                    {client.client_name}
                                                </td>
                                                <td className="py-2 text-slate-500 font-medium">
                                                    {client.area || "N/A"}
                                                </td>
                                                <td className="py-2 text-right text-green-600 font-medium">
                                                    +
                                                    {formatValue(
                                                        client.change || 0,
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </TabsContent>
                    <TabsContent value="decreased">
                        <div className="max-h-96 overflow-y-auto mt-4">
                            {decreasedClients.length === 0 ? (
                                <div className="text-center text-slate-500 font-medium py-12">
                                    No clients with decreased revenue in this
                                    period.
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-slate-50/30">
                                        <tr className="border-b border-slate-100">
                                            <th className="text-left py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                                                Client Name
                                            </th>
                                            <th className="text-left py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                                                Area
                                            </th>
                                            <th className="text-right py-2 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                                                Change
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {decreasedClients.map((client, i) => (
                                            <tr
                                                key={i}
                                                className="border-b border-slate-50 last:border-0"
                                            >
                                                <td className="py-2 font-medium text-slate-800">
                                                    {client.client_name}
                                                </td>
                                                <td className="py-2 text-slate-500 font-medium">
                                                    {client.area || "N/A"}
                                                </td>
                                                <td className="py-2 text-right text-red-600 font-medium">
                                                    {formatValue(
                                                        client.change || 0,
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

interface ExistingClientsTooltipProps {
    active?: boolean;
    payload?: Array<{ payload?: ExistingClientsChartDataPoint }>;
    label?: string;
    period: string;
    viewAsHours?: boolean;
}

function ExistingClientsCustomTooltip({
    active,
    payload,
    label,
    period,
    viewAsHours,
}: ExistingClientsTooltipProps) {
    const dataPoint = payload?.[0]?.payload;
    if (active && dataPoint) {
        const upVal = Math.abs(dataPoint.revenue_increases ?? 0);
        const downVal = Math.abs(dataPoint.revenue_decreases ?? 0);
        const netVal = dataPoint.net_change ?? 0;

        return (
            <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-card text-slate-800 text-sm">
                <p className="font-semibold mb-2 text-slate-800">
                    {formatPeriodLabel(label ?? "", period)}
                </p>
                <div className="space-y-1">
                    <p className="text-green-600">
                        + Expansion ({dataPoint.increase_count}):{" "}
                        {viewAsHours
                            ? `${upVal.toFixed(1)}h`
                            : formatCurrency(upVal * BILLING_RATE)}
                    </p>
                    <p className="text-red-600">
                        − Contraction ({dataPoint.decrease_count}):{" "}
                        {viewAsHours
                            ? `${downVal.toFixed(1)}h`
                            : formatCurrency(downVal * BILLING_RATE)}
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

/**
 * Main ExistingClients Component - Uses unified 1-month comparison metrics
 */
export function ExistingClients({
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
}: ExistingClientsProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
    const [modalIncreasedClients, setModalIncreasedClients] = useState<
        ClientInfo[]
    >([]);
    const [modalDecreasedClients, setModalDecreasedClients] = useState<
        ClientInfo[]
    >([]);

    // Convert metrics to chart data format
    const chartData = useMemo(() => {
        if (!clientMetrics || clientMetrics.length === 0) return [];

        return clientMetrics.map((m) => {
            // Convert revenue to hours for display
            const upHours = m.existingClientsUpRevenue / BILLING_RATE;
            const downHours = m.existingClientsDownRevenue / BILLING_RATE;
            const netHours = m.netExistingRevenue / BILLING_RATE;

            return {
                bucket: m.month,
                label: m.label,
                // For chart bars (hours)
                revenue_increases: upHours,
                revenue_decreases: -downHours, // Negative for downward bar
                net_change: netHours,
                // Counts
                increase_count: m.existingClientsUpCount,
                decrease_count: m.existingClientsDownCount,
                // Raw revenue values
                increase_total: m.existingClientsUpRevenue,
                decrease_total: m.existingClientsDownRevenue,
                net_revenue_change: m.netExistingRevenue,
            };
        });
    }, [clientMetrics]);

    // Adapter function to convert new metrics format to old MonthlyExistingClientsPanel format
    const allMonthlyData = useMemo(() => {
        if (!clientMetrics || clientMetrics.length === 0) return null;

        return {
            start_date: startMonth || "",
            end_date: endMonth || "",
            data: clientMetrics.map((m) => ({
                ref_month: `${m.month}-01`,
                count: m.existingClientsUpCount + m.existingClientsDownCount,
                data: [
                    ...m.existingClientsUp.map((c) => ({
                        client_name: c.client_name,
                        area: c.area || "N/A",
                        monthly_revenue: c.monthly_revenue,
                        client_type: "Existing" as const,
                        rev_ref_month: c.monthly_revenue,
                        change: c.change,
                    })),
                    ...m.existingClientsDown.map((c) => ({
                        client_name: c.client_name,
                        area: c.area || "N/A",
                        monthly_revenue: c.monthly_revenue,
                        client_type: "Existing" as const,
                        rev_ref_month: c.monthly_revenue,
                        change: c.change,
                    })),
                ],
            })),
        };
    }, [clientMetrics, startMonth, endMonth]);

    const handleChartClick = (e: {
        activePayload?: { payload: ExistingClientsChartDataPoint }[];
    }) => {
        if (e?.activePayload && e.activePayload.length > 0) {
            const payload = e.activePayload[0].payload;

            // Call the global chart click handler to update the from date
            if (onChartPointClick) {
                onChartPointClick(payload);
            }

            // Get metrics for this month and show modal
            const metrics = getMonthMetrics(payload.bucket);
            if (metrics) {
                setModalIncreasedClients(metrics.existingClientsUp);
                setModalDecreasedClients(metrics.existingClientsDown);
            }
            setSelectedBucket(payload.bucket);
            setIsModalOpen(true);
        }
    };

    if (loading) {
        return (
            <Card className="rounded-2xl border-slate-100 animate-pulse">
                <CardHeader>
                    <div className="h-6 bg-slate-100 rounded w-1/3"></div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                    <div className="h-48 bg-slate-100 rounded"></div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <Card className="w-full rounded-2xl border-slate-100">
                    <CardHeader>
                        <CardTitle className="font-heading font-bold text-slate-800 text-xl flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <Users className="size-5" />
                            </span>
                            Existing Clients {viewAsHours ? "Hours" : "Revenue"}
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
                                                <ExistingClientsCustomTooltip
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

                                        {/* Expansion Bar (positive) */}
                                        <Bar
                                            dataKey="revenue_increases"
                                            fill="#7AB1DD"
                                            name={
                                                viewAsHours
                                                    ? "Expansion Hours"
                                                    : "Expansion Revenue"
                                            }
                                            radius={[4, 4, 0, 0]}
                                        />

                                        {/* Contraction Bar (negative) */}
                                        <Bar
                                            dataKey="revenue_decreases"
                                            fill="#AACDE9"
                                            name={
                                                viewAsHours
                                                    ? "Contraction Hours"
                                                    : "Contraction Revenue"
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
                    </CardContent>
                </Card>

                {/* Monthly Existing Clients Panel */}
                {startMonth && endMonth && (
                    <MonthlyExistingClientsPanel
                        startMonth={startMonth}
                        endMonth={endMonth}
                        selectedAreas={selectedAreas}
                        viewAsHours={viewAsHours}
                        allMonthlyData={allMonthlyData}
                        areas={areas}
                    />
                )}
            </div>

            <ExistingClientDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                bucket={selectedBucket}
                period={period}
                increasedClients={modalIncreasedClients}
                decreasedClients={modalDecreasedClients}
                viewAsHours={viewAsHours}
            />
        </>
    );
}
