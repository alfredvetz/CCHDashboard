export interface MonthlyExistingClientsData {
    ref_month: string;
    count: number;
    data: ExistingClientRow[];
}

export interface ExistingClientsBulkResponse {
    start_date: string;
    end_date: string;
    data: MonthlyExistingClientsData[];
}

export interface AggregatedAreaRevenue {
    area: string;
    total_revenue: string;
}

export interface RevenueByAreaResponse {
    start_date: string;
    end_date: string;
    data: MonthlyAreaData[];
}

export interface AreaRevenueData {
    area: string;
    total_revenue: number;
}

export interface MonthlyAreaData {
    month: string;
    areas: AreaRevenueData[];
}

export interface ExistingClientRow {
    client_name: string;
    area: string;
    monthly_revenue: number;
    rev_ref_month: number;
    client_type?: string;
}

export interface AreaFilterParams {
    area?: string | string[] | null;
}
