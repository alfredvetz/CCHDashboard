import { useMemo } from "react";
import type { ExistingClientsBulkResponse } from "@/types/api";

const BILLING_RATE = 70.22;

export interface ClientInfo {
    client_name: string;
    area: string | null;
    monthly_revenue: number;
    change?: number; // For existing clients: current - previous
    prev_revenue?: number; // For lost clients: their revenue from last month
}

export interface MonthlyClientMetrics {
    month: string; // YYYY-MM format
    label: string; // Display label like "Oct 25"

    // Previous month baseline
    previousMonthTotal: number;

    // New clients (active this month, not last month)
    newClients: ClientInfo[];
    newClientsCount: number;
    newClientsRevenue: number;

    // Lost clients (active last month, not this month)
    lostClients: ClientInfo[];
    lostClientsCount: number;
    lostClientsRevenue: number; // Their revenue from LAST month (what we lost)

    // Net new (new - lost)
    netNewRevenue: number;

    // Existing clients with changes
    existingClientsUp: ClientInfo[];
    existingClientsUpCount: number;
    existingClientsUpRevenue: number; // Total expansion

    existingClientsDown: ClientInfo[];
    existingClientsDownCount: number;
    existingClientsDownRevenue: number; // Total contraction (positive number)

    // Net existing (expansion - contraction)
    netExistingRevenue: number;

    // Current month total (should equal previousMonthTotal + netNew + netExisting)
    currentMonthTotal: number;
}

// Helper to normalize month format to YYYY-MM
function normalizeYm(s: string): string {
    return s?.slice(0, 7) || s;
}

// Helper to get previous month key
function getPrevMonthKey(ym: string): string {
    const [year, month] = ym.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1); // month-1 for 0-indexed, then -1 for previous
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
}

// Helper to format month label
function formatMonthLabel(ym: string): string {
    const date = new Date(ym + "-01");
    return date.toLocaleDateString("en-AU", {
        month: "short",
        year: "2-digit",
    });
}

export function useClientMetrics(
    existingClientsData: ExistingClientsBulkResponse | null,
    startMonth: string,
    endMonth: string,
) {
    const metrics = useMemo<MonthlyClientMetrics[]>(() => {
        if (
            !existingClientsData?.data ||
            existingClientsData.data.length === 0
        ) {
            return [];
        }

        // Build a map of client -> {revenue, area} for each month
        // Only include clients with POSITIVE revenue (they are "active")
        const clientsByMonth = new Map<
            string,
            Map<string, { revenue: number; area: string | null }>
        >();

        existingClientsData.data.forEach((monthData) => {
            const ym = normalizeYm(monthData.ref_month);
            const clientMap = new Map<
                string,
                { revenue: number; area: string | null }
            >();

            monthData.data.forEach((client) => {
                const revenue = Number(client.monthly_revenue) || 0;
                // Only include clients with positive revenue - they are "active" this month
                if (revenue > 0) {
                    clientMap.set(client.client_name, {
                        revenue,
                        area: client.area || null,
                    });
                }
            });

            clientsByMonth.set(ym, clientMap);
        });

        // Generate list of months in the display range
        const months: string[] = [];
        const [startYear, startMonthNum] = startMonth.split("-").map(Number);
        const [endYear, endMonthNum] = endMonth.split("-").map(Number);

        const current = new Date(startYear, startMonthNum - 1, 1);
        const end = new Date(endYear, endMonthNum - 1, 1);

        while (current <= end) {
            const ym = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
            months.push(ym);
            current.setMonth(current.getMonth() + 1);
        }

        // Calculate metrics for each month
        return months.map((ym) => {
            const currentClients = clientsByMonth.get(ym) || new Map();
            const prevYm = getPrevMonthKey(ym);
            const prevClients = clientsByMonth.get(prevYm) || new Map();

            // Calculate previous month total
            let previousMonthTotal = 0;
            prevClients.forEach(({ revenue }) => {
                previousMonthTotal += revenue;
            });

            // Calculate current month total
            let currentMonthTotal = 0;
            currentClients.forEach(({ revenue }) => {
                currentMonthTotal += revenue;
            });

            // NEW clients: in current, not in previous
            const newClients: ClientInfo[] = [];
            currentClients.forEach(({ revenue, area }, clientName) => {
                if (!prevClients.has(clientName)) {
                    newClients.push({
                        client_name: clientName,
                        area,
                        monthly_revenue: revenue,
                    });
                }
            });
            newClients.sort((a, b) => b.monthly_revenue - a.monthly_revenue);

            // LOST clients: in previous, not in current
            const lostClients: ClientInfo[] = [];
            prevClients.forEach(({ revenue, area }, clientName) => {
                if (!currentClients.has(clientName)) {
                    lostClients.push({
                        client_name: clientName,
                        area,
                        monthly_revenue: 0, // They have 0 this month
                        prev_revenue: revenue, // What they had last month
                    });
                }
            });
            lostClients.sort(
                (a, b) => (b.prev_revenue || 0) - (a.prev_revenue || 0),
            );

            // EXISTING clients: in both months
            const existingClientsUp: ClientInfo[] = [];
            const existingClientsDown: ClientInfo[] = [];

            currentClients.forEach(
                ({ revenue: currentRev, area }, clientName) => {
                    const prevData = prevClients.get(clientName);
                    if (prevData) {
                        const change = currentRev - prevData.revenue;
                        if (change > 0) {
                            existingClientsUp.push({
                                client_name: clientName,
                                area,
                                monthly_revenue: currentRev,
                                change,
                            });
                        } else if (change < 0) {
                            existingClientsDown.push({
                                client_name: clientName,
                                area,
                                monthly_revenue: currentRev,
                                change, // negative
                            });
                        }
                        // If change === 0, client is stable, not included in either list
                    }
                },
            );

            existingClientsUp.sort((a, b) => (b.change || 0) - (a.change || 0));
            existingClientsDown.sort(
                (a, b) => (a.change || 0) - (b.change || 0),
            ); // Most negative first

            // Calculate totals
            const newClientsRevenue = newClients.reduce(
                (sum, c) => sum + c.monthly_revenue,
                0,
            );
            const lostClientsRevenue = lostClients.reduce(
                (sum, c) => sum + (c.prev_revenue || 0),
                0,
            );
            const existingClientsUpRevenue = existingClientsUp.reduce(
                (sum, c) => sum + (c.change || 0),
                0,
            );
            const existingClientsDownRevenue = Math.abs(
                existingClientsDown.reduce(
                    (sum, c) => sum + (c.change || 0),
                    0,
                ),
            );

            return {
                month: ym,
                label: formatMonthLabel(ym),
                previousMonthTotal,
                newClients,
                newClientsCount: newClients.length,
                newClientsRevenue,
                lostClients,
                lostClientsCount: lostClients.length,
                lostClientsRevenue,
                netNewRevenue: newClientsRevenue - lostClientsRevenue,
                existingClientsUp,
                existingClientsUpCount: existingClientsUp.length,
                existingClientsUpRevenue,
                existingClientsDown,
                existingClientsDownCount: existingClientsDown.length,
                existingClientsDownRevenue,
                netExistingRevenue:
                    existingClientsUpRevenue - existingClientsDownRevenue,
                currentMonthTotal,
            };
        });
    }, [existingClientsData, startMonth, endMonth]);

    // Helper to get metrics for a specific month
    const getMonthMetrics = useMemo(() => {
        return (month: string): MonthlyClientMetrics | undefined => {
            const ym = normalizeYm(month);
            return metrics.find((m) => m.month === ym);
        };
    }, [metrics]);

    // Convert revenue to hours
    const toHours = (revenue: number) => revenue / BILLING_RATE;

    return {
        metrics,
        getMonthMetrics,
        toHours,
        BILLING_RATE,
    };
}

export default useClientMetrics;
