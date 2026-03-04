export type Period = "monthly" | "weekly" | "fortnightly";

export interface TotalsRow {
    bucket: string;
    total_revenue: number;
    client_count: number;
}

export interface OverviewKpis {
    avgRevenuePerClient: number;
    avgMonthlyChange: number;
}

export interface MovementsRow {
    bucket: string;
    new_client_count: number;
    lost_client_count: number;
    net_client_count: number;
    new_client_revenue: number;
    lost_client_revenue: number;
    net_total_revenue: number;
}

export interface ExistingRow {
    bucket: string;
    increase_count: number;
    decrease_count: number;
    increase_total: number;
    decrease_total: number;
    net_revenue_change: number;
}

export interface DashboardData {
    overview: { totals: TotalsRow[]; kpis: OverviewKpis };
    movements: { movements: MovementsRow[] };
    existing: { existing: ExistingRow[]; avgRevPctChange: number };
}
