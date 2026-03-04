"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import { useFilters } from "@/hooks/use-filters";
import { useImpersonation } from "@/hooks/use-impersonation";

type FiltersValue = ReturnType<typeof useFilters>;

const FiltersContext = createContext<FiltersValue | null>(null);

interface FiltersProviderProps {
    children: React.ReactNode;
    userEmail?: string;
    displayName?: string;
}

export function FiltersProvider({
    children,
    userEmail = "User@example.com",
    displayName = "User",
}: FiltersProviderProps) {
    const [currentUserProfile] = useState<{
        role?: string;
        area_uuid?: string | null;
        area_name?: string | null;
        community_uuid?: string | null;
        community_name?: string | null;
        staff_uid?: number | null;
    } | null>(null);
    const { getEffectiveUser } = useImpersonation(userEmail);
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

    return (
        <FiltersContext.Provider value={filters}>
            {children}
        </FiltersContext.Provider>
    );
}

export function useFiltersContext(): FiltersValue {
    const ctx = useContext(FiltersContext);
    if (!ctx) {
        throw new Error("useFiltersContext must be used within FiltersProvider");
    }
    return ctx;
}
