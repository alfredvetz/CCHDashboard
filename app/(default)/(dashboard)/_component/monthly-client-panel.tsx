"use client";

import { useState, useEffect, useMemo } from "react";
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
    UserPlus,
    UserMinus,
    Users,
} from "lucide-react";
import { formatCurrency } from "../../../../utils/format";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Interfaces
interface NewClient {
    month_start: string;
    client_key: string;
    client_uid: number;
    client_name: string;
    area: string;
    monthly_revenue: number;
    missing_prev_months: string[];
}

interface LostClient {
    client_key: string;
    client_uid: number | null;
    client_name: string;
    area: string | null;
    rev_3_months_ago: number;
    rev_2_months_ago: number;
    rev_1_month_ago: number;
    label_3_months_ago: string;
    label_2_months_ago: string;
    label_1_month_ago: string;
    active_prev_months_count: number;
}

/** Raw API item from new_clients.data */
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

interface MonthlyClientPanelProps {
    startMonth: string;
    endMonth: string;
    initialMonth?: string;
    viewAsHours?: boolean;
    clientMovementDetails: ClientMovementDetail[];
    getMonthData: (refMonth: string) => ClientMovementDetail | null;
    areas?: { UUID: string; Area: string }[]; // Pass areas as prop instead of fetching
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

// Helper function to convert yearMonth to ref_month format
function yearMonthToRefMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split("-").map(Number);
    return `${year}-${month.toString().padStart(2, "0")}-01`;
}

export function MonthlyClientPanel({
    startMonth,
    endMonth,
    initialMonth,
    viewAsHours,
    clientMovementDetails,
    getMonthData,
    areas = [],
}: MonthlyClientPanelProps) {
    const [currentMonth, setCurrentMonth] = useState<string>(
        initialMonth || startMonth,
    );
    const [newClients, setNewClients] = useState<NewClient[]>([]);
    const [lostClients, setLostClients] = useState<LostClient[]>([]);
    const [selectedArea, setSelectedArea] = useState<string>("all");
    const [edgeNewNames, setEdgeNewNames] = useState<string[]>([]);
    const [edgeLostNames, setEdgeLostNames] = useState<string[]>([]);

    const monthList = useMemo(
        () => generateMonthList(startMonth, endMonth),
        [startMonth, endMonth],
    );
    const currentMonthIndex = monthList.findIndex(
        (month) => month.value === currentMonth,
    );
    const canGoLeft = currentMonthIndex > 0;
    const canGoRight = currentMonthIndex < monthList.length - 1;

    const refMonth = useMemo(
        () => yearMonthToRefMonth(currentMonth),
        [currentMonth],
    );

    // Get current month's data from props
    const currentMonthData = useMemo(() => {
        const data = getMonthData(refMonth);
        // If exact match fails, try finding by YYYY-MM prefix
        if (
            !data &&
            clientMovementDetails &&
            Array.isArray(clientMovementDetails)
        ) {
            const yearMonthPrefix = refMonth.substring(0, 7); // YYYY-MM
            return (
                clientMovementDetails.find(
                    (d) => d.ref_month?.substring(0, 7) === yearMonthPrefix,
                ) || null
            );
        }
        return data;
    }, [getMonthData, clientMovementDetails, refMonth]);

    // Update clients when current month changes
    useEffect(() => {
        queueMicrotask(() => {
            if (currentMonthData?.new_clients?.data) {
                const mapped = currentMonthData.new_clients.data.map(
                    (c: NewClientApiItem) =>
                        ({
                            month_start: c.month_start,
                            client_key: c.client_key,
                            client_uid: c.client_uid,
                            client_name: c.client_name,
                            area: c.area || "N/A",
                            monthly_revenue: c.monthly_revenue || 0,
                            missing_prev_months: [],
                        }) as NewClient,
                );
                setNewClients(mapped);
                setEdgeNewNames(mapped.map((m: NewClient) => m.client_name));
            } else {
                setNewClients([]);
                setEdgeNewNames([]);
            }
            if (currentMonthData?.lost_clients?.data) {
                const mappedLost = currentMonthData.lost_clients.data.map(
                    (c: LostClientApiItem) =>
                        ({
                            client_key: c.client_key,
                            client_uid: c.client_uid || null,
                            client_name: c.client_name,
                            area: c.area || "N/A",
                            rev_3_months_ago: 0,
                            rev_2_months_ago: 0,
                            // Prefer explicit rev_1_month_ago from API; fallback to monthly_revenue if provided
                            rev_1_month_ago:
                                typeof c.rev_1_month_ago === "number"
                                    ? c.rev_1_month_ago
                                    : c.monthly_revenue || 0,
                            label_3_months_ago: "",
                            label_2_months_ago: "",
                            label_1_month_ago: "",
                            active_prev_months_count: 0,
                        }) as LostClient,
                );
                setLostClients(mappedLost);
                setEdgeLostNames(
                    mappedLost.map((m: LostClient) => m.client_name),
                );
            } else {
                setLostClients([]);
                setEdgeLostNames([]);
            }
        });
    }, [currentMonthData]);

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

    // Helper: previous month of the currently selected month
    const previousYearMonth = useMemo(() => {
        if (!currentMonth) return "";
        const [y, m] = currentMonth.split("-").map(Number);
        const prevM = m === 1 ? 12 : m - 1;
        const prevY = m === 1 ? y - 1 : y;
        return `${prevY}-${String(prevM).padStart(2, "0")}`;
    }, [currentMonth]);

    // Sort clients by amount (largest first) with last-month-only logic
    const sortedNewClients = useMemo(() => {
        // Map the edge names to detailed rows; if a name is missing in detail API, create a placeholder
        if (edgeNewNames.length === 0) {
            return [...newClients].sort(
                (a, b) => (b.monthly_revenue || 0) - (a.monthly_revenue || 0),
            );
        }
        const byName = new Map(
            newClients.map((c) => [c.client_name, c] as const),
        );
        const rows = edgeNewNames.map(
            (name) =>
                byName.get(name) ||
                ({
                    month_start: "",
                    client_key: `${name}`,
                    client_uid: 0,
                    client_name: name,
                    area: "N/A",
                    monthly_revenue: 0,
                    missing_prev_months: [],
                } as NewClient),
        );
        return rows.sort(
            (a, b) => (b.monthly_revenue || 0) - (a.monthly_revenue || 0),
        );
    }, [newClients, edgeNewNames]);

    const sortedLostClients = useMemo(() => {
        if (edgeLostNames.length === 0) {
            // Show all, even if last revenue is 0 (some endpoints may return 0 for lost)
            return [...lostClients].sort(
                (a, b) => (b.rev_1_month_ago || 0) - (a.rev_1_month_ago || 0),
            );
        }
        const byName = new Map(
            lostClients.map((c) => [c.client_name, c] as const),
        );
        const rows = edgeLostNames.map(
            (name) =>
                byName.get(name) ||
                ({
                    client_key: `${name}`,
                    client_uid: null,
                    client_name: name,
                    area: "N/A",
                    rev_3_months_ago: 0,
                    rev_2_months_ago: 0,
                    rev_1_month_ago: 0,
                    label_3_months_ago: "",
                    label_2_months_ago: "",
                    label_1_month_ago: "",
                    active_prev_months_count: 0,
                } as LostClient),
        );
        return rows.sort(
            (a, b) => (b.rev_1_month_ago || 0) - (a.rev_1_month_ago || 0),
        );
    }, [lostClients, edgeLostNames]);

    // Filter by selected area
    const filteredNewClients = useMemo(() => {
        let filtered = sortedNewClients;

        // Filter by area
        if (selectedArea !== "all") {
            filtered = filtered.filter((c) => c.area === selectedArea);
        }

        // Filter out clients with 0 revenue/hours
        filtered = filtered.filter((c) => (c.monthly_revenue || 0) > 0);

        return filtered;
    }, [sortedNewClients, selectedArea]);

    const filteredLostClients = useMemo(() => {
        let filtered = sortedLostClients;

        // Filter by area
        if (selectedArea !== "all") {
            filtered = filtered.filter(
                (c) => (c.area || "N/A") === selectedArea,
            );
        }

        return filtered;
    }, [sortedLostClients, selectedArea]);

    // Totals for new/lost panels
    const totalNewAmount = useMemo(
        () =>
            filteredNewClients.reduce(
                (sum, c) => sum + (c.monthly_revenue || 0),
                0,
            ),
        [filteredNewClients],
    );
    const totalLostAmount = useMemo(
        () =>
            filteredLostClients.reduce(
                (sum, c) => sum + (c.rev_1_month_ago || 0),
                0,
            ),
        [filteredLostClients],
    );
    const netAmount = useMemo(
        () => totalNewAmount - totalLostAmount,
        [totalNewAmount, totalLostAmount],
    );

    return (
        <Card className="w-full border-0">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="leading-none flex items-center font-heading font-bold">
                        <Users className="h-5 w-5 mr-2 text-muted-foreground" />
                        {viewAsHours
                            ? "Monthly Client Hours"
                            : "Monthly Clients"}
                        <span className="ml-3 text-blue-600 text-sm font-semibold tabular-nums">
                            {viewAsHours
                                ? `${(netAmount / 70.22).toFixed(1)}h`
                                : formatCurrency(netAmount)}
                        </span>
                    </CardTitle>

                    {/* Area Filter + Month Navigation */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground whitespace-nowrap">
                                Area:
                            </Label>
                            <Select
                                value={selectedArea}
                                onValueChange={setSelectedArea}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="All Areas" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[280px]">
                                    <div className="max-h-[240px] overflow-y-auto">
                                        <SelectItem value="all">
                                            All Areas
                                        </SelectItem>
                                        {areas?.map((a) => (
                                            <SelectItem
                                                key={a.UUID}
                                                value={a.Area}
                                            >
                                                {a.Area}
                                            </SelectItem>
                                        ))}
                                    </div>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Month Navigation */}
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

                            <div className="min-w-[200px] flex justify-center text-center">
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
                    {/* New Clients Panel */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <UserPlus className="h-5 w-5 text-green-600" />
                            <h4 className="text-lg font-semibold">
                                New Clients
                            </h4>
                            <Badge variant="secondary" className="ml-auto">
                                {filteredNewClients.length}
                            </Badge>
                            <div className="text-sm font-medium text-green-600 tabular-nums">
                                {viewAsHours
                                    ? `${(totalNewAmount / 70.22).toFixed(1)}h`
                                    : formatCurrency(totalNewAmount)}
                            </div>
                        </div>

                        {newClients.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground">
                                No new clients in {currentMonthLabel}
                            </div>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Client Name</TableHead>
                                            <TableHead>Area</TableHead>
                                            <TableHead className="text-right">
                                                {viewAsHours
                                                    ? "Hours"
                                                    : "Revenue"}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredNewClients.map(
                                            (client, index) => (
                                                <TableRow
                                                    key={`${client.client_key}-${index}`}
                                                >
                                                    <TableCell className="font-medium">
                                                        {client.client_name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {client.area}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-green-600">
                                                        {viewAsHours
                                                            ? `${(client.monthly_revenue / 70.22).toFixed(1)}h`
                                                            : formatCurrency(
                                                                  client.monthly_revenue,
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

                    {/* Lost Clients Panel */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <UserMinus className="h-5 w-5 text-red-600" />
                            <h4 className="text-lg font-semibold">
                                Lost Clients
                            </h4>
                            <Badge variant="secondary" className="ml-auto">
                                {filteredLostClients.length}
                            </Badge>
                            <div className="text-sm font-medium text-red-600 tabular-nums">
                                {viewAsHours
                                    ? `${(totalLostAmount / 70.22).toFixed(1)}h`
                                    : formatCurrency(totalLostAmount)}
                            </div>
                        </div>

                        {lostClients.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground">
                                No lost clients in {currentMonthLabel}
                            </div>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Client Name</TableHead>
                                            <TableHead>Area</TableHead>
                                            <TableHead className="text-right">
                                                {viewAsHours
                                                    ? "Last Hours"
                                                    : "Last Revenue"}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLostClients.map(
                                            (client, index) => (
                                                <TableRow
                                                    key={`${client.client_key}-${index}`}
                                                >
                                                    <TableCell className="font-medium">
                                                        {client.client_name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {client.area || "N/A"}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-red-600">
                                                        {viewAsHours
                                                            ? `${(client.rev_1_month_ago / 70.22).toFixed(1)}h`
                                                            : formatCurrency(
                                                                  client.rev_1_month_ago,
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
        </Card>
    );
}
