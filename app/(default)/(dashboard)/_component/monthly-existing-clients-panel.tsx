"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    Users,
} from "lucide-react";
import { formatCurrency } from "../../../../utils/format";
// Removed useAreas import - areas now passed as prop
import { ClientRevenueModal } from "./client-revenue-modal";

// Import types from centralized API types
import type {
    ExistingClientRow,
    ExistingClientsBulkResponse,
} from "@/types/api";

// Source row may include pre-calculated change (from useClientMetrics)
type ExistingClientRowSource = ExistingClientRow & { change?: number };

// Local interfaces for component-specific data shapes
interface ExistingClient {
    client_name: string;
    area: string;
    rev_ref_month: number;
    prev_month_revenue: number;
    changeAmount: number;
}

interface ExistingClientWithChange extends ExistingClient {
    changeAmount: number;
}

interface MonthlyExistingClientsPanelProps {
    startMonth: string;
    endMonth: string;
    initialMonth?: string;
    viewAsHours?: boolean;
    fromDate?: string;
    toDate?: string;
    areas?: { UUID: string; Area: string }[]; // Pass areas as prop instead of fetching
    selectedAreas?: string[]; // Selected areas to filter by (from global filter)
    allMonthlyData?: ExistingClientsBulkResponse | null; // Accept data as prop
}

// Helper function to generate month list within range
function generateMonthList(
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
            month: "long",
            year: "numeric",
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

// Helper function to convert yearMonth to ref_month format (last day of month)
function yearMonthToRefMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split("-").map(Number);
    return `${year}-${month.toString().padStart(2, "0")}-01`;
}

// Helper function to convert yearMonth to window start/end format
function yearMonthToWindowDates(
    yearMonth: string,
    startMonth: string,
    endMonth: string,
): { window_start: string; window_end: string } {
    const [startYear, startMonthNum] = startMonth.split("-").map(Number);

    const window_start = `${startYear}-${startMonthNum.toString().padStart(2, "0")}-01`;
    // window_end should be the end of the month before ref_month
    const [currentYear, currentMonth] = yearMonth.split("-").map(Number);
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const window_end = `${prevYear}-${prevMonth.toString().padStart(2, "0")}-${lastDayOfPrevMonth.toString().padStart(2, "0")}`;

    return { window_start, window_end };
}

// UTC helper functions for date conversion
function startOfMonthISO(iso: string): string {
    const [y, m] = iso.slice(0, 7).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
}

function firstOfNextMonthISO(iso: string): string {
    const [y, m] = iso.slice(0, 7).split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

export function MonthlyExistingClientsPanel({
    startMonth,
    endMonth,
    initialMonth,
    viewAsHours,
    fromDate,
    toDate,
    areas = [],
    selectedAreas: propSelectedAreas = [],
    allMonthlyData = null,
}: MonthlyExistingClientsPanelProps) {
    // Generate month list first to determine the initial month
    const allMonths = useMemo(
        () => generateMonthList(startMonth, endMonth),
        [startMonth, endMonth],
    );
    const filteredMonths = useMemo(() => allMonths.slice(1), [allMonths]); // Skip first month

    const [currentMonth, setCurrentMonth] = useState<string>(() => {
        // Use initialMonth (from global filters "To:" value) if it's in the filtered list, otherwise use the last available month
        if (
            initialMonth &&
            filteredMonths.some((m) => m.value === initialMonth)
        ) {
            return initialMonth;
        }
        return filteredMonths.length > 0
            ? filteredMonths[filteredMonths.length - 1].value
            : endMonth;
    });

    // Calculate date range for API call (kept for consistency, though not used for fetching now)
    const apiFromDate = useMemo(
        () => fromDate || startOfMonthISO(startMonth),
        [fromDate, startMonth],
    );
    const apiToDate = useMemo(
        () => toDate || firstOfNextMonthISO(endMonth),
        [toDate, endMonth],
    );

    // Use propSelectedAreas directly, no local state needed
    const selectedAreas = useMemo(() => propSelectedAreas, [propSelectedAreas]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClientName, setSelectedClientName] = useState<string | null>(
        null,
    );

    const monthList = filteredMonths;
    const currentMonthIndex = monthList.findIndex(
        (month) => month.value === currentMonth,
    );
    const canGoLeft = currentMonthIndex > 0;
    const canGoRight = currentMonthIndex < monthList.length - 1;

    // Determine loading state based on data presence (simple heuristic)
    const loading = !allMonthlyData;
    const error = null;

    // Get current month's data from the bulk response
    const existingClients = useMemo(() => {
        if (!allMonthlyData || !allMonthlyData.data) return [];

        const refMonth = yearMonthToRefMonth(currentMonth);
        const monthData = allMonthlyData.data.find(
            (m) =>
                m.ref_month === refMonth ||
                m.ref_month?.substring(0, 7) === refMonth.substring(0, 7),
        );

        if (!monthData || !monthData.data) return [];

        // Get previous month's data to calculate changes
        const prevMonth =
            currentMonthIndex > 0
                ? monthList[currentMonthIndex - 1]?.value
                : null;
        const prevRefMonth = prevMonth ? yearMonthToRefMonth(prevMonth) : null;
        const prevMonthData = prevRefMonth
            ? allMonthlyData.data.find(
                  (m) =>
                      m.ref_month === prevRefMonth ||
                      m.ref_month?.substring(0, 7) ===
                          prevRefMonth.substring(0, 7),
              )
            : null;

        // Create a map of previous month's revenue by client name
        const prevRevenueMap = new Map<string, number>();
        if (prevMonthData?.data) {
            prevMonthData.data.forEach((client) => {
                prevRevenueMap.set(
                    client.client_name,
                    client.rev_ref_month || client.monthly_revenue,
                );
            });
        }

        // Map current month's data
        // When data comes from useClientMetrics (via ExistingClients), it's already filtered to existing clients
        // The 'change' property is pre-calculated, so use it if available
        return (
            monthData.data
                .map((client) => {
                    // If change is pre-calculated (from useClientMetrics), use it
                    // Otherwise calculate from previous month
                    const preCalculatedChange = (
                        client as ExistingClientRowSource
                    ).change;
                    const prevRevenue =
                        prevRevenueMap.get(client.client_name) || 0;
                    const changeAmount =
                        preCalculatedChange !== undefined
                            ? preCalculatedChange
                            : (client.rev_ref_month || client.monthly_revenue) -
                              prevRevenue;

                    return {
                        client_name: client.client_name,
                        area: client.area,
                        rev_ref_month:
                            client.rev_ref_month || client.monthly_revenue,
                        prev_month_revenue: prevRevenue,
                        changeAmount,
                    } as ExistingClient;
                })
                // Filter out clients with no change
                .filter((client) => client.changeAmount !== 0)
        );
    }, [allMonthlyData, currentMonth, currentMonthIndex, monthList]);

    // Process existing clients data to separate revenue up/down
    const {
        revenueUpClients,
        revenueDownClients,
        revenueUpTotal,
        revenueDownTotal,
    } = useMemo(() => {
        const up: ExistingClientWithChange[] = [];
        const down: ExistingClientWithChange[] = [];

        existingClients.forEach((client) => {
            // changeAmount is already calculated in existingClients useMemo
            if (client.changeAmount > 0) {
                up.push({ ...client, changeAmount: client.changeAmount });
            } else if (client.changeAmount < 0) {
                down.push({ ...client, changeAmount: client.changeAmount });
            }
        });

        // Totals are the sum of changes (up positive, down negative)
        const revenueUpTotal = up.reduce(
            (sum, client) => sum + client.changeAmount,
            0,
        );
        const revenueDownTotal = down.reduce(
            (sum, client) => sum + client.changeAmount,
            0,
        );

        return {
            revenueUpClients: up,
            revenueDownClients: down,
            revenueUpTotal,
            revenueDownTotal,
        };
    }, [existingClients]);

    // Sort by largest magnitude of change (descending for up, ascending for down which are negatives)
    const sortedRevenueUp = useMemo(() => {
        return [...revenueUpClients].sort(
            (a, b) => (b.changeAmount || 0) - (a.changeAmount || 0),
        );
    }, [revenueUpClients]);
    const sortedRevenueDown = useMemo(() => {
        return [...revenueDownClients].sort(
            (a, b) => (a.changeAmount || 0) - (b.changeAmount || 0),
        );
    }, [revenueDownClients]);

    // Filter by area
    const filteredRevenueUp = useMemo(() => {
        if (selectedAreas.length === 0) return sortedRevenueUp;
        return sortedRevenueUp.filter((c) => selectedAreas.includes(c.area));
    }, [sortedRevenueUp, selectedAreas]);
    const filteredRevenueDown = useMemo(() => {
        if (selectedAreas.length === 0) return sortedRevenueDown;
        return sortedRevenueDown.filter((c) => selectedAreas.includes(c.area));
    }, [sortedRevenueDown, selectedAreas]);

    const netChangeTotal = useMemo(
        () => revenueUpTotal + revenueDownTotal,
        [revenueUpTotal, revenueDownTotal],
    );

    // Internal fetching logic REMOVED - data now passed via props
    // useEffect(() => { ... fetchExistingClients ... }, [apiFromDate, apiToDate, selectedAreas]);

    const handlePreviousMonth = () => {
        if (canGoLeft) {
            setCurrentMonth(monthList[currentMonthIndex - 1].value);
        }
    };

    const handleNextMonth = () => {
        if (canGoRight) {
            setCurrentMonth(monthList[currentMonthIndex + 1].value);
        }
    };

    const currentMonthLabel =
        monthList.find((month) => month.value === currentMonth)?.label ||
        currentMonth;

    const handleClientNameClick = (clientName: string) => {
        setSelectedClientName(clientName);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedClientName(null);
    };

    // If no months available after filtering, show a message
    if (monthList.length === 0) {
        return (
            <Card className="w-full border-0">
                <CardHeader>
                    <CardTitle className="leading-none flex items-center font-heading font-bold">
                        <Users className="h-5 w-5 mr-2 text-muted-foreground" />
                        {viewAsHours
                            ? "Monthly Existing Client Hours"
                            : "Monthly Existing Clients"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-8">
                        No data available. At least two months are required to
                        show existing client changes.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full border-0">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="leading-none flex items-center font-heading font-bold">
                        <Users className="h-5 w-5 mr-2 text-muted-foreground" />
                        {viewAsHours
                            ? "Monthly Existing Client Hours"
                            : "Monthly Existing Clients"}
                        <span className="ml-3 text-blue-600 text-sm font-semibold tabular-nums">
                            {viewAsHours
                                ? `${(netChangeTotal / 70.22).toFixed(1)}h`
                                : formatCurrency(netChangeTotal)}
                        </span>
                    </CardTitle>

                    {/* Area Filter + Month Navigation */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            {/* Removed local area dropdown as global filter controls it now */}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePreviousMonth}
                                disabled={!canGoLeft}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="min-w-[200px] text-center flex justify-center">
                                <h3 className="text-lg font-semibold">
                                    {currentMonthLabel}
                                </h3>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextMonth}
                                disabled={!canGoRight}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Revenue Up Clients Panel */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            <h4 className="text-lg font-semibold">
                                {viewAsHours ? "Hours Up" : "Revenue Up"}
                            </h4>
                            <Badge variant="secondary" className="ml-auto">
                                {filteredRevenueUp.length}
                            </Badge>
                            <div className="text-sm font-medium text-green-600 tabular-nums">
                                {viewAsHours
                                    ? `${(revenueUpTotal / 70.22).toFixed(1)}h`
                                    : formatCurrency(revenueUpTotal)}
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-48 flex items-center justify-center">
                                <div className="animate-pulse text-muted-foreground">
                                    Loading revenue up clients...
                                </div>
                            </div>
                        ) : error ? (
                            <div className="h-48 flex items-center justify-center text-red-600">
                                Error: {error}
                            </div>
                        ) : filteredRevenueUp.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground">
                                No revenue up clients in {currentMonthLabel}
                            </div>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Client Name</TableHead>
                                            <TableHead>Area</TableHead>
                                            <TableHead className="text-right">
                                                Change
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRevenueUp.map(
                                            (client, index) => (
                                                <TableRow
                                                    key={`${client.client_name}-${index}`}
                                                >
                                                    <TableCell className="font-medium">
                                                        <Button
                                                            type="button"
                                                            variant="link"
                                                            onClick={() =>
                                                                handleClientNameClick(
                                                                    client.client_name,
                                                                )
                                                            }
                                                            className="text-foreground hover:underline cursor-pointer text-left h-auto p-0 font-medium"
                                                        >
                                                            {client.client_name}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell>
                                                        {client.area}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-green-600">
                                                        {viewAsHours
                                                            ? `+${((client.changeAmount || 0) / 70.22).toFixed(1)}h`
                                                            : `+${formatCurrency(client.changeAmount || 0)}`}
                                                    </TableCell>
                                                </TableRow>
                                            ),
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>

                    {/* Revenue Down Clients Panel */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingDown className="h-5 w-5 text-red-600" />
                            <h4 className="text-lg font-semibold">
                                {viewAsHours ? "Hours Down" : "Revenue Down"}
                            </h4>
                            <Badge variant="secondary" className="ml-auto">
                                {filteredRevenueDown.length}
                            </Badge>
                            <div className="text-sm font-medium text-red-600 tabular-nums">
                                {viewAsHours
                                    ? `${(revenueDownTotal / 70.22).toFixed(1)}h`
                                    : formatCurrency(revenueDownTotal)}
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-48 flex items-center justify-center">
                                <div className="animate-pulse text-muted-foreground">
                                    Loading revenue down clients...
                                </div>
                            </div>
                        ) : error ? (
                            <div className="h-48 flex items-center justify-center text-red-600">
                                Error: {error}
                            </div>
                        ) : filteredRevenueDown.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground">
                                No revenue down clients in {currentMonthLabel}
                            </div>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Client Name</TableHead>
                                            <TableHead>Area</TableHead>
                                            <TableHead className="text-right">
                                                Change
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRevenueDown.map(
                                            (client, index) => (
                                                <TableRow
                                                    key={`${client.client_name}-${index}`}
                                                >
                                                    <TableCell className="font-medium">
                                                        <Button
                                                            type="button"
                                                            variant="link"
                                                            onClick={() =>
                                                                handleClientNameClick(
                                                                    client.client_name,
                                                                )
                                                            }
                                                            className="text-foreground hover:underline cursor-pointer text-left h-auto p-0 font-medium"
                                                        >
                                                            {client.client_name}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell>
                                                        {client.area}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-red-600">
                                                        {viewAsHours
                                                            ? `${((client.changeAmount || 0) / 70.22).toFixed(1)}h`
                                                            : formatCurrency(
                                                                  client.changeAmount ||
                                                                      0,
                                                              )}
                                                    </TableCell>
                                                </TableRow>
                                            ),
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>

            {/* Client Revenue Modal */}
            <ClientRevenueModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                clientName={selectedClientName}
                endDate={
                    currentMonth ? yearMonthToRefMonth(currentMonth) : undefined
                }
                viewAsHours={viewAsHours}
            />
        </Card>
    );
}
