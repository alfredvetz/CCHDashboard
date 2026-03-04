"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../../../utils/format";
import { useClientRevenue } from "@/hooks/use-client-revenue";
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";

interface ClientRevenueModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string | null;
    endDate?: string;
    viewAsHours?: boolean;
}

export function ClientRevenueModal({
    isOpen,
    onClose,
    clientName,
    endDate,
    viewAsHours,
}: ClientRevenueModalProps) {
    const { data, loading, error } = useClientRevenue(clientName, endDate);
    const BILLING_RATE = 70.22;

    // Process the data for the chart
    const chartData =
        data?.months.map((month) => ({
            month: new Date(month.month_start).toLocaleDateString("en-AU", {
                month: "short",
                year: "2-digit",
            }),
            revenue: parseFloat(month.monthly_revenue),
            hours: parseFloat(month.monthly_revenue) / BILLING_RATE,
        })) || [];

    // Calculate trend
    const getTrend = () => {
        if (chartData.length < 2)
            return { direction: "neutral", percentage: 0 };

        const first = chartData[0].revenue;
        const last = chartData[chartData.length - 1].revenue;
        const percentage = first > 0 ? ((last - first) / first) * 100 : 0;

        return {
            direction:
                percentage > 0.1
                    ? "up"
                    : percentage < -0.1
                      ? "down"
                      : "neutral",
            percentage: Math.abs(percentage),
        };
    };

    const trend = getTrend();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-[1400px] max-w-[1400px] max-h-[90vh] overflow-y-auto bg-card">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        {clientName
                            ? `${clientName}'s Revenue History`
                            : "Client Revenue History"}
                    </DialogTitle>
                </DialogHeader>

                {loading && (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-pulse text-muted-foreground">
                            Loading revenue data...
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-red-600">Error: {error}</div>
                    </div>
                )}

                {data && !loading && !error && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Total Revenue (6 months)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {viewAsHours
                                            ? `${chartData.reduce((sum, item) => sum + item.hours, 0).toFixed(1)}h`
                                            : formatCurrency(
                                                  chartData.reduce(
                                                      (sum, item) =>
                                                          sum + item.revenue,
                                                      0,
                                                  ),
                                              )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Average Monthly
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {viewAsHours
                                            ? `${(chartData.reduce((sum, item) => sum + item.hours, 0) / chartData.length).toFixed(1)}h`
                                            : formatCurrency(
                                                  chartData.reduce(
                                                      (sum, item) =>
                                                          sum + item.revenue,
                                                      0,
                                                  ) / chartData.length,
                                              )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        6-Month Trend
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2">
                                        {trend.direction === "up" && (
                                            <TrendingUp className="h-4 w-4 text-green-600" />
                                        )}
                                        {trend.direction === "down" && (
                                            <TrendingDown className="h-4 w-4 text-red-600" />
                                        )}
                                        {trend.direction === "neutral" && (
                                            <DollarSign className="h-4 w-4 text-gray-600" />
                                        )}
                                        <span
                                            className={`text-2xl font-bold ${
                                                trend.direction === "up"
                                                    ? "text-green-600"
                                                    : trend.direction === "down"
                                                      ? "text-red-600"
                                                      : "text-muted-foreground"
                                            }`}
                                        >
                                            {trend.direction === "up"
                                                ? "+"
                                                : trend.direction === "down"
                                                  ? "-"
                                                  : ""}
                                            {trend.percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Chart and Table Side by Side */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Chart - Takes up 2/3 of the space */}
                            <div className="lg:col-span-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Calendar className="h-5 w-5" />
                                            {viewAsHours
                                                ? "Monthly Hours"
                                                : "Monthly Revenue"}{" "}
                                            (Last 6 Months)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-80">
                                            <ResponsiveContainer
                                                width="100%"
                                                height="100%"
                                            >
                                                <LineChart
                                                    data={chartData}
                                                    margin={{
                                                        top: 10,
                                                        right: 30,
                                                        left: 20,
                                                        bottom: 5,
                                                    }}
                                                >
                                                    <CartesianGrid
                                                        stroke="var(--border)"
                                                        strokeDasharray="3 3"
                                                    />
                                                    <XAxis
                                                        dataKey="month"
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
                                                        tickFormatter={(
                                                            value,
                                                        ) =>
                                                            viewAsHours
                                                                ? `${value.toFixed(1)}h`
                                                                : formatCurrency(
                                                                      value,
                                                                  )
                                                        }
                                                    />
                                                    <Tooltip
                                                        formatter={(
                                                            value: number,
                                                        ) => [
                                                            viewAsHours
                                                                ? `${value.toFixed(1)}h`
                                                                : formatCurrency(
                                                                      value,
                                                                  ),
                                                            viewAsHours
                                                                ? "Hours"
                                                                : "Revenue",
                                                        ]}
                                                        labelFormatter={(
                                                            label,
                                                        ) => `Month: ${label}`}
                                                        contentStyle={{
                                                            backgroundColor:
                                                                "white",
                                                            border: "1px solid var(--border)",
                                                            borderRadius:
                                                                "var(--radius)",
                                                        }}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey={
                                                            viewAsHours
                                                                ? "hours"
                                                                : "revenue"
                                                        }
                                                        stroke="#2d75af"
                                                        strokeWidth={3}
                                                        dot={{
                                                            r: 4,
                                                            fill: "#2d75af",
                                                        }}
                                                        activeDot={{
                                                            r: 6,
                                                            fill: "#2d75af",
                                                        }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Data Table - Takes up 1/3 of the space */}
                            <div className="lg:col-span-1">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Monthly Breakdown</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 max-h-80 overflow-y-auto">
                                            {chartData.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="flex justify-between items-center py-2 border-b border-border last:border-b-0"
                                                >
                                                    <span className="font-medium text-sm">
                                                        {item.month}
                                                    </span>
                                                    <span className="font-mono text-sm">
                                                        {viewAsHours
                                                            ? `${item.hours.toFixed(1)}h`
                                                            : formatCurrency(
                                                                  item.revenue,
                                                              )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <Button onClick={onClose} variant="outline">
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
