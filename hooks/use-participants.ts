"use client";

import { useState, useEffect, useRef } from "react";

export interface ParticipantItem {
    UID: number;
    clientFullName: string | null;
    Area: string | null;
    Community: string | null;
    Suburb: string | null;
    Gender: string | null;
    DOB: string | null;
    MobileNumber: number | null;
    PlanStart: string | null;
    PlanEnd: string | null;
    Funding: "MAX_HOURS_PER_WEEK" | "DOLLARS_REMAINING" | "UNKNOWN" | null;
    Total: number | null;
    EvidencePath: string | null;
    Verified: boolean;
    "Street Number": string | null;
    "Street Name": string | null;
    State: string | null;
    Postcode: string | null;
    "Full Address": string | null;
}

interface ParticipantsResponse {
    data: ParticipantItem[];
}

interface UseParticipantsOptions {
    community?: string | null;
    area?: string | null;
}

/**
 * Hook to fetch participants data
 * @param options - Optional filters for community or area
 */
export function useParticipants(options?: UseParticipantsOptions) {
    const { community, area } = options || {};
    const [participants, setParticipants] = useState<ParticipantItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isFetchingRef = useRef(false);

    useEffect(() => {
        const fetchParticipants = async () => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            setLoading(true);
            setError(null);

            try {
                const participantsUrl =
                    process.env.NEXT_PUBLIC_SUPABASE_PARTICIPANTSINFO || "";
                const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

                if (!participantsUrl) {
                    throw new Error(
                        "NEXT_PUBLIC_SUPABASE_PARTICIPANTSINFO is not set",
                    );
                }

                if (!anonKey) {
                    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
                }

                // Build URL with query parameters for filtering
                let finalUrl = participantsUrl;
                try {
                    const url = new URL(participantsUrl);
                    if (community) {
                        url.searchParams.set("community", community);
                    } else if (area) {
                        url.searchParams.set("area", area);
                    }
                    finalUrl = url.toString();
                } catch (urlError) {
                    // If URL construction fails, append query params manually
                    console.warn(
                        "URL construction failed, using manual query params:",
                        urlError,
                    );
                    const separator = participantsUrl.includes("?") ? "&" : "?";
                    if (community) {
                        finalUrl = `${participantsUrl}${separator}community=${encodeURIComponent(community)}`;
                    } else if (area) {
                        finalUrl = `${participantsUrl}${separator}area=${encodeURIComponent(area)}`;
                    }
                }

                const response = await fetch(finalUrl, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${anonKey}`,
                        "Content-Type": "application/json",
                        apikey: anonKey,
                    },
                });

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch participants: ${response.status}`,
                    );
                }

                const result = await response.json();

                // Handle response format
                let participantsData: ParticipantItem[] = [];
                if (result && typeof result === "object") {
                    if (Array.isArray(result)) {
                        participantsData = result;
                    } else if (result.data && Array.isArray(result.data)) {
                        participantsData = result.data;
                    }
                }

                setParticipants(participantsData);
            } catch (err) {
                console.error("Failed to fetch participants:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch participants",
                );
                setParticipants([]);
            } finally {
                setLoading(false);
                isFetchingRef.current = false;
            }
        };

        fetchParticipants();
    }, [community, area]);

    const updateParticipant = async (
        uid: number,
        updates: Partial<ParticipantItem>,
    ) => {
        // Store previous state for rollback on error
        const previousParticipants = participants;

        try {
            // Optimistic update - update UI immediately
            setParticipants((prev) =>
                prev.map((p) => (p.UID === uid ? { ...p, ...updates } : p)),
            );

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

            if (!supabaseUrl || !anonKey) {
                throw new Error("Supabase configuration missing");
            }

            // Map the updates to match database column names
            const dbUpdates: any = {};
            if (updates.PlanStart !== undefined)
                dbUpdates.PlanStart = updates.PlanStart;
            if (updates.PlanEnd !== undefined)
                dbUpdates.PlanEnd = updates.PlanEnd;
            if (updates.Funding !== undefined)
                dbUpdates.Funding = updates.Funding;
            if (updates.Total !== undefined) dbUpdates.Total = updates.Total;
            if (updates.EvidencePath !== undefined)
                dbUpdates.EvidencePath = updates.EvidencePath;
            if (updates.Verified !== undefined)
                dbUpdates.Verified = updates.Verified;

            // Using Edge Function (bypasses RLS with service role key)
            const updateEndpoint =
                process.env.NEXT_PUBLIC_SUPABASE_UPDATEPARTICIPANTS ||
                `${supabaseUrl}/functions/v1/updateParticipant`;

            const response = await fetch(updateEndpoint, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${anonKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ uid, updates: dbUpdates }),
            });

            const responseText = await response.text();
            let responseData;

            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
                responseData = { error: responseText };
            }

            if (!response.ok) {
                const errorMessage = responseData?.error
                    ? typeof responseData.error === "string"
                        ? responseData.error
                        : JSON.stringify(responseData.error)
                    : responseText || `HTTP ${response.status}`;

                throw new Error(
                    `Failed to update participant: ${errorMessage}`,
                );
            }
        } catch (err) {
            console.error("Failed to update participant:", err);
            // Rollback optimistic update on error
            setParticipants(previousParticipants);
            throw err;
        }
    };

    return { participants, loading, error, updateParticipant };
}
