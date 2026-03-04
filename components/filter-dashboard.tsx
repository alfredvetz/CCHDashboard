"use client";
import { useFilters } from "@/hooks/use-filters";
import { useImpersonation } from "@/hooks/use-impersonation";
import React, { useMemo, useState } from "react";
import { FilterBar } from "./filter-bar";
import { useAreas } from "@/hooks/use-areas";

export default function FilterDashboard() {
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

    const isFilterLocked = useMemo(() => {
        const role = effectiveRole?.toLowerCase();
        return role === "area manager" || role === "community lead";
    }, [effectiveRole]);

    const initialSelectedAreas = useMemo(() => {
        const role = effectiveRole?.toLowerCase();
        if (role === "admin" || role === "business development") {
            return [];
        }

        if (role === "community lead" && effectiveCommunityName) {
            return [effectiveCommunityName];
        }
        if (role === "area manager" && effectiveAreaName) {
            return [effectiveAreaName];
        }

        return [];
    }, [effectiveRole, effectiveAreaName, effectiveCommunityName]);

    const filters = useFilters({
        initialSelectedAreas,
        isFilterLocked,
    });

    const isCommunityLead = useMemo(() => {
        const role = effectiveRole?.toLowerCase();
        return role === "community lead";
    }, [effectiveRole]);

    return (
        <div>
            <FilterBar
                startMonth={filters.startMonth}
                endMonth={filters.endMonth}
                onStartMonthChange={filters.goToStartMonth}
                onEndMonthChange={filters.goToEndMonth}
                selectedAreas={filters.selectedAreas}
                onAreasChange={filters.onAreasChange}
                isFilterLocked={filters.isFilterLocked}
                onClearAll={filters.handleClearAll}
                areas={areas ?? undefined}
                areaLabelOverride={
                    isCommunityLead && effectiveCommunityName
                        ? effectiveCommunityName
                        : undefined
                }
            />
        </div>
    );
}
