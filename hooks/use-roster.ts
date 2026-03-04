"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

export interface RosterShift {
    id: number;
    shift_id: string;
    shift_start: string;
    shift_end: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type: "scheduled" | "cancelled" | "needs-support";
    cancelled: boolean;
    cancel_reason: string | null;
    shift_note: string | null;
    length_hours: number | null;
    length_minutes: number | null;

    // Staff information
    staff_uid: number | null;
    employee_name: string | null;
    staff_full_name: string | null;
    staff_mobile: string | null;

    // Community information
    community_uuid: string | null;
    site_name: string | null;
    community_name: string | null;

    // Area information
    area_uuid: string | null;
    area_name: string | null;

    // Participants (array)
    participants: string[];
    participant_uids: number[];

    created_at: string;
    updated_at: string;
}

export interface UseRosterOptions {
    // Date filtering
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD

    // Staff filtering
    staffUid?: number;
    staffName?: string;
    tbaOnly?: boolean; // Only shifts with no staff assigned

    // Participant filtering
    participantUid?: number;
    participantName?: string;

    // Status filtering
    shiftType?: "scheduled" | "cancelled" | "needs-support";
    cancelled?: boolean;

    // Community/Area filtering
    communityUuid?: string;
    areaUuid?: string;

    // Limit results
    limit?: number;

    // Auto-refresh
    enabled?: boolean;
}

/**
 * Hook to fetch roster/shift data from the database.
 * Uses the v_roster_with_details view for efficient querying with all related data.
 */
export function useRoster(options: UseRosterOptions = {}) {
    const {
        startDate,
        endDate,
        staffUid,
        staffName,
        tbaOnly = false,
        participantUid,
        participantName,
        shiftType,
        cancelled,
        communityUuid,
        areaUuid,
        limit,
        enabled = true,
    } = options;

    const [shifts, setShifts] = useState<RosterShift[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isFetchingRef = useRef(false);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        const fetchRoster = async () => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            setLoading(true);
            setError(null);

            try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                const supabaseAnonKey =
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

                if (!supabaseUrl || !supabaseAnonKey) {
                    throw new Error("Supabase configuration is missing");
                }

                const supabase = createClient(supabaseUrl, supabaseAnonKey);

                console.log(
                    "[useRoster] Fetching roster data with options:",
                    options,
                );

                // Build query
                let query = supabase.from("v_roster_with_details").select("*");

                // Date filtering - expand range if not specified to show more data
                if (startDate) {
                    query = query.gte("shift_date", startDate);
                } else {
                    // If no start date, default to 30 days ago
                    const defaultStart = new Date();
                    defaultStart.setDate(defaultStart.getDate() - 30);
                    query = query.gte(
                        "shift_date",
                        defaultStart.toISOString().split("T")[0],
                    );
                }
                if (endDate) {
                    query = query.lte("shift_date", endDate);
                } else {
                    // If no end date, default to 60 days from now
                    const defaultEnd = new Date();
                    defaultEnd.setDate(defaultEnd.getDate() + 60);
                    query = query.lte(
                        "shift_date",
                        defaultEnd.toISOString().split("T")[0],
                    );
                }

                // Staff filtering
                if (staffUid) {
                    query = query.eq("staff_uid", staffUid);
                } else if (staffName) {
                    query = query.ilike("employee_name", `%${staffName}%`);
                }
                // Note: TBA filtering will be done client-side for better reliability

                // Participant filtering
                if (participantUid) {
                    // For participant filtering, we need to check if the participant_uid array contains the value
                    // This is a bit tricky with Supabase, so we'll filter client-side if needed
                    // For now, we'll fetch all and filter
                } else if (participantName) {
                    // Filter by participant name (check if array contains)
                    // This will be filtered client-side
                }

                // Status filtering
                if (shiftType) {
                    query = query.eq("shift_type", shiftType);
                }
                if (cancelled !== undefined) {
                    query = query.eq("cancelled", cancelled);
                }

                // Community/Area filtering
                if (communityUuid) {
                    query = query.eq("community_uuid", communityUuid);
                }
                if (areaUuid) {
                    query = query.eq("area_uuid", areaUuid);
                }

                // Ordering
                query = query
                    .order("shift_date", { ascending: true })
                    .order("start_time", { ascending: true });

                // Limit
                if (limit) {
                    query = query.limit(limit);
                }

                const { data, error: queryError } = await query;

                if (queryError) {
                    console.error("[useRoster] Query error:", queryError);
                    throw new Error(
                        `Failed to fetch roster: ${queryError.message}`,
                    );
                }

                console.log("[useRoster] Fetched", data?.length || 0, "shifts");

                // Debug: Log sample of fetched data
                if (data && data.length > 0) {
                    console.log("[useRoster] Sample shift data:", {
                        first: data[0],
                        sampleTBA: data.find(
                            (s: any) =>
                                !s.staff_uid ||
                                !s.employee_name ||
                                s.employee_name?.toLowerCase() === "tba",
                        ),
                        totalWithStaff: data.filter((s: any) => s.staff_uid)
                            .length,
                        totalWithoutStaff: data.filter((s: any) => !s.staff_uid)
                            .length,
                    });
                } else {
                    // If no data, check if there's any data at all in the table
                    const { data: allData, error: checkError } = await supabase
                        .from("v_roster_with_details")
                        .select(
                            "id, shift_id, shift_date, employee_name, staff_uid",
                        )
                        .limit(5);
                    console.log(
                        "[useRoster] No data in date range. Sample from entire table:",
                        {
                            sample: allData,
                            error: checkError,
                        },
                    );
                }

                // Client-side filtering for participant and TBA (since Supabase array/null filtering is limited)
                let filteredData = data || [];

                // TBA filtering: no staff assigned
                if (tbaOnly) {
                    filteredData = filteredData.filter((shift: any) => {
                        const noStaffUid =
                            !shift.staff_uid || shift.staff_uid === null;
                        const employeeName = shift.employee_name?.trim() || "";
                        const noEmployeeName =
                            !employeeName ||
                            employeeName === "" ||
                            employeeName.toLowerCase() === "tba" ||
                            employeeName.toLowerCase() === "t.b.a." ||
                            employeeName.toLowerCase() === "t.b.a";
                        const isTBA = noStaffUid || noEmployeeName;

                        if (!isTBA) {
                            console.log(
                                "[useRoster] Shift filtered out (not TBA):",
                                {
                                    shift_id: shift.shift_id,
                                    staff_uid: shift.staff_uid,
                                    employee_name: shift.employee_name,
                                },
                            );
                        }

                        return isTBA;
                    });
                    console.log(
                        "[useRoster] TBA filtering: kept",
                        filteredData.length,
                        "out of",
                        (data || []).length,
                        "shifts",
                    );
                }

                if (participantUid) {
                    filteredData = filteredData.filter(
                        (shift: any) =>
                            shift.participant_uids &&
                            Array.isArray(shift.participant_uids) &&
                            shift.participant_uids.includes(participantUid),
                    );
                }

                if (participantName) {
                    filteredData = filteredData.filter(
                        (shift: any) =>
                            shift.participants &&
                            Array.isArray(shift.participants) &&
                            shift.participants.some(
                                (p: string) =>
                                    p &&
                                    p
                                        .toLowerCase()
                                        .includes(
                                            participantName.toLowerCase(),
                                        ),
                            ),
                    );
                }

                // Transform to match our interface
                const transformedShifts: RosterShift[] = filteredData.map(
                    (row: any) => ({
                        id: row.id,
                        shift_id: row.shift_id,
                        shift_start: row.shift_start,
                        shift_end: row.shift_end,
                        shift_date: row.shift_date,
                        start_time: row.start_time,
                        end_time: row.end_time,
                        shift_type: row.shift_type as
                            | "scheduled"
                            | "cancelled"
                            | "needs-support",
                        cancelled: row.cancelled || false,
                        cancel_reason: row.cancel_reason,
                        shift_note: row.shift_note,
                        length_hours: row.length_hours,
                        length_minutes: row.length_minutes,
                        staff_uid: row.staff_uid,
                        employee_name: row.employee_name,
                        staff_full_name: row.staff_full_name,
                        staff_mobile: row.staff_mobile,
                        community_uuid: row.community_uuid,
                        site_name: row.site_name,
                        community_name: row.community_name,
                        area_uuid: row.area_uuid,
                        area_name: row.area_name,
                        participants: row.participants || [],
                        participant_uids: row.participant_uids || [],
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                    }),
                );

                setShifts(transformedShifts);
            } catch (err) {
                console.error("[useRoster] Error fetching roster:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch roster data",
                );
                setShifts([]);
            } finally {
                setLoading(false);
                isFetchingRef.current = false;
            }
        };

        fetchRoster();
    }, [
        enabled,
        startDate,
        endDate,
        staffUid,
        staffName,
        tbaOnly,
        participantUid,
        participantName,
        shiftType,
        cancelled,
        communityUuid,
        areaUuid,
        limit,
        options,
    ]);

    return { shifts, loading, error };
}

/**
 * Hook specifically for TBA shifts (shifts with no staff assigned)
 * Convenience wrapper around useRoster with tbaOnly=true
 */
export function useTBAShifts(options: Omit<UseRosterOptions, "tbaOnly"> = {}) {
    return useRoster({ ...options, tbaOnly: true });
}

/**
 * Hook for shifts assigned to a specific staff member
 * Convenience wrapper around useRoster
 */
export function useStaffShifts(
    staffUidOrName: number | string,
    options: Omit<UseRosterOptions, "staffUid" | "staffName"> = {},
) {
    const isUid = typeof staffUidOrName === "number";
    return useRoster({
        ...options,
        ...(isUid
            ? { staffUid: staffUidOrName }
            : { staffName: staffUidOrName }),
    });
}
