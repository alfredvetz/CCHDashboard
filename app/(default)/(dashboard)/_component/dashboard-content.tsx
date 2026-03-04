"use client";
import React, { useMemo, useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useFiltersContext } from "@/contexts/filters-context";
import { useImpersonation } from "@/hooks/use-impersonation";
import { useExistingClientsData } from "@/hooks/use-existing-clients-data";
import RevenueBreakdownChart from "./revenue-breakdown-chart";
import { RevenueByAreaChart } from "./revenue-by-area-chart";
import { useMonthlyRevenueByArea } from "@/hooks/use-monthly-revenue-by-area";
import { useAreas } from "@/hooks/use-areas";
import { NewVsLost } from "./new-vs-lost";
import { useClientMetrics } from "@/hooks/use-client-metrics";
import { ExistingClients } from "./existing-clients";

interface RevenuePoint {
    bucket: string;
    total_revenue: number;
}

const edgeUrl = process.env.NEXT_PUBLIC_SUPABASE_EDGE_URL!;

export default function DashboardContent() {
    const [clientArea, setClientArea] = useState<string>("all");

    const { areas } = useAreas();

    const [currentUserProfile, setCurrentUserProfile] = useState<{
        role?: string;
        area_uuid?: string | null;
        area_name?: string | null;
        community_uuid?: string | null;
        community_name?: string | null;
        staff_uid?: number | null;
    } | null>(null);
    const userEmail = "User@example.com";
    const displayName = "User";
    const {
        impersonatedUser,
        canImpersonate,
        getEffectiveUser,
        startImpersonation,
        stopImpersonation,
    } = useImpersonation(userEmail);

    const effectiveUser = getEffectiveUser({
        email: userEmail,
        full_name: displayName,
        area_uuid: currentUserProfile?.area_uuid,
        area_name: currentUserProfile?.area_name,
        community_uuid: currentUserProfile?.community_uuid,
        community_name: currentUserProfile?.community_name,
        staff_uid: currentUserProfile?.staff_uid ?? null,
    });
    const effectiveCommunityName = effectiveUser.isImpersonated
        ? effectiveUser.community_name
        : currentUserProfile?.community_name;

    const effectiveRole = effectiveUser.isImpersonated
        ? effectiveUser.role
        : currentUserProfile?.role;

    const effectiveAreaName = effectiveUser.isImpersonated
        ? effectiveUser.area_name
        : currentUserProfile?.area_name;

    const isAreaRestricted = useMemo(() => {
        const role = effectiveRole?.toLowerCase();
        return !!(
            role === "area manager" ||
            role === "community lead" ||
            role === "staff"
        );
    }, [effectiveRole]);

    const isCommunityLead = useMemo(() => {
        const role = effectiveRole?.toLowerCase();
        return role === "community lead";
    }, [effectiveRole]);

    const filters = useFiltersContext();

    const areaForApi = useMemo(() => {
        if (isAreaRestricted && effectiveAreaName) {
            return [effectiveAreaName];
        }

        if (filters.selectedAreas && filters.selectedAreas.length > 0) {
            return filters.selectedAreas;
        }
        if (clientArea && clientArea !== "all") {
            return [clientArea];
        }
        return null;
    }, [
        filters.selectedAreas,
        clientArea,
        isAreaRestricted,
        effectiveAreaName,
    ]);

    const { data, clientCounts, loading, error } = useDashboardData(
        filters.fromDate,
        filters.toDate,
        edgeUrl,
        areaForApi,
    );

    const { data: existingClientsData, loading: existingClientsLoading } =
        useExistingClientsData(
            filters.startMonth,
            filters.endMonth,
            Array.isArray(areaForApi)
                ? areaForApi
                : areaForApi
                  ? [areaForApi]
                  : [],
        );

    const { metrics: clientMetrics, getMonthMetrics } = useClientMetrics(
        existingClientsData,
        filters.startMonth,
        filters.endMonth,
    );

    const revenueData: RevenuePoint[] = data.map((item) => ({
        bucket: item.bucket,
        total_revenue: item.total_revenue,
    }));

    const {
        monthlyData: monthlyRevenueData,
        aggregatedData: revenueByAreaData,
        monthlyLoading: monthlyRevenueLoading,
        monthlyError: monthlyRevenueError,
    } = useMonthlyRevenueByArea(
        filters.startMonth,
        filters.endMonth,
        areaForApi,
    );

    const revenueByAreaLoading =
        Object.values(monthlyRevenueLoading).some((loading) => loading) ||
        false;

    return (
        <div className="space-y-8">
            <RevenueBreakdownChart
                revenueData={revenueData}
                existingClientsData={existingClientsData}
                loading={!!loading || !!existingClientsLoading}
                onChartPointClick={filters.handleChartPointClickForEndMonth}
            />
            <RevenueByAreaChart
                data={revenueByAreaData.map((item) => ({
                    area: item.area,
                    revenue: parseFloat(item.total_revenue),
                }))}
                startMonth={filters.startMonth}
                endMonth={filters.endMonth}
                monthlyData={monthlyRevenueData}
                monthlyLoading={monthlyRevenueLoading}
                loading={revenueByAreaLoading}
                onChartPointClick={filters.handleChartPointClickForEndMonth}
                selectedAreas={
                    isCommunityLead && effectiveCommunityName
                        ? [effectiveCommunityName]
                        : []
                }
                availableAreas={
                    (filters.selectedAreas &&
                        filters.selectedAreas.length > 0) ||
                    (isAreaRestricted && effectiveAreaName)
                        ? []
                        : areas?.map((a) => a.Area) || []
                }
                isCommunityView={
                    (filters.selectedAreas &&
                        filters.selectedAreas.length > 0) ||
                    (isAreaRestricted && !!effectiveAreaName)
                }
            />
            <NewVsLost
                clientMetrics={clientMetrics}
                getMonthMetrics={getMonthMetrics}
                period={filters.period}
                selectedAreas={filters.selectedAreas}
                loading={!!existingClientsLoading}
                startMonth={filters.startMonth}
                endMonth={filters.endMonth}
                onChartPointClick={filters.handleChartPointClickForEndMonth}
                areas={areas || []}
            />
            <ExistingClients
                clientMetrics={clientMetrics}
                getMonthMetrics={getMonthMetrics}
                period={filters.period}
                selectedAreas={filters.selectedAreas}
                loading={!!existingClientsLoading}
                startMonth={filters.startMonth}
                endMonth={filters.endMonth}
                onChartPointClick={filters.handleChartPointClickForEndMonth}
                areas={areas || []}
            />
        </div>
    );
}
