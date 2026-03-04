"use client";

import { useState, useEffect, useCallback } from "react";

export interface ImpersonatedUser {
    id: string;
    email: string;
    full_name: string;
    role?: string;
    area_uuid?: string | null;
    area_name?: string | null;
    community_uuid?: string | null;
    community_name?: string | null;
    staff_uid?: number | null;
}

const IMPERSONATION_KEY = "cch_impersonated_user";

const IMPERSONATION_ALLOWED_EMAILS = [
    "ash@choicecommunityhealth.com.au",
    "paul@choicecommunityhealth.com.au",
    "trevor@choicecommunityhealth.com.au",
    "test@example.com",
];

export function useImpersonation(currentUserEmail?: string) {
    const [impersonatedUser, setImpersonatedUser] =
        useState<ImpersonatedUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const canImpersonate = currentUserEmail
        ? IMPERSONATION_ALLOWED_EMAILS.includes(currentUserEmail.toLowerCase())
        : false;

    useEffect(() => {
        queueMicrotask(() => {
            try {
                const stored = sessionStorage.getItem(IMPERSONATION_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored) as ImpersonatedUser;
                    setImpersonatedUser(parsed);
                }
            } catch {}
            setIsLoading(false);
        });
    }, []);

    const startImpersonation = useCallback(
        (user: ImpersonatedUser) => {
            if (!canImpersonate) {
                console.warn("User not authorized to impersonate");
                return;
            }

            setImpersonatedUser(user);
            try {
                sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(user));
            } catch {
                // Silently fail
            }
        },
        [canImpersonate],
    );

    const stopImpersonation = useCallback(() => {
        setImpersonatedUser(null);
        try {
            sessionStorage.removeItem(IMPERSONATION_KEY);
        } catch {
            // Silently fail
        }
    }, []);

    // Get the effective user (impersonated or current)
    const getEffectiveUser = useCallback(
        (currentUser: {
            email?: string;
            full_name?: string;
            area_uuid?: string | null;
            area_name?: string | null;
            community_uuid?: string | null;
            community_name?: string | null;
            staff_uid?: number | null;
        }) => {
            if (impersonatedUser) {
                return {
                    email: impersonatedUser.email,
                    displayName: impersonatedUser.full_name,
                    isImpersonated: true,
                    role: impersonatedUser.role,
                    area_uuid: impersonatedUser.area_uuid,
                    area_name: impersonatedUser.area_name,
                    community_uuid: impersonatedUser.community_uuid,
                    community_name: impersonatedUser.community_name,
                    staff_uid: impersonatedUser.staff_uid ?? null,
                };
            }
            return {
                email: currentUser.email || "",
                displayName: currentUser.full_name || "User",
                isImpersonated: false,
                role: undefined,
                area_uuid: currentUser.area_uuid,
                area_name: currentUser.area_name,
                community_uuid: currentUser.community_uuid,
                community_name: currentUser.community_name,
                staff_uid: currentUser.staff_uid ?? null,
            };
        },
        [impersonatedUser],
    );

    return {
        impersonatedUser,
        canImpersonate,
        isLoading,
        startImpersonation,
        stopImpersonation,
        getEffectiveUser,
    };
}

export function useAvailableUsers() {
    const [users, setUsers] = useState<ImpersonatedUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { invokeFunction } = await import("@/utils/request");

            const response = await invokeFunction<{
                data: Array<{
                    id: string;
                    email: string;
                    full_name: string;
                    role: string;
                    is_active: boolean;
                    area_uuid?: string | null;
                    area_name?: string | null;
                    community_uuid?: string | null;
                    community_name?: string | null;
                }>;
            }>("users", { method: "GET" });

            const activeUsers = (response.data || [])
                .filter((u) => u.is_active)
                .map((u) => ({
                    id: u.id,
                    email: u.email,
                    full_name: u.full_name,
                    role: u.role.charAt(0).toUpperCase() + u.role.slice(1),
                    area_uuid: u.area_uuid,
                    area_name: u.area_name || null,
                    community_uuid: u.community_uuid,
                    community_name: u.community_name || null,
                }));

            setUsers(activeUsers);
        } catch (err) {
            console.error("Failed to fetch users for impersonation:", err);
            setError(
                err instanceof Error ? err.message : "Failed to fetch users",
            );

            const fallbackUsers: ImpersonatedUser[] = [
                {
                    id: "1",
                    email: "ash@choicecommunityhealth.com.au",
                    full_name: "Ash",
                    role: "Admin",
                },
                {
                    id: "2",
                    email: "paul@choicecommunityhealth.com.au",
                    full_name: "Paul",
                    role: "Admin",
                },
                {
                    id: "3",
                    email: "trevor@choicecommunityhealth.com.au",
                    full_name: "Trevor",
                    role: "Admin",
                },
            ];
            setUsers(fallbackUsers);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    return { users, loading, error, refetch: fetchUsers };
}
