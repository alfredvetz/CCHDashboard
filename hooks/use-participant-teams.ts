"use client";

import { useState, useEffect } from "react";

export interface ParticipantTeamResponse {
    data: Record<number, string[]>; // client_uid -> array of staff names
    month: string;
}

/**
 * Hook to fetch participant teams (unique staff) for all participants for last month
 */
export function useParticipantTeams() {
    const [teams, setTeams] = useState<Record<number, string[]>>({});
    const [month, setMonth] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);

        const fetchTeams = async () => {
            try {
                const teamsUrl = process.env.NEXT_PUBLIC_SUPABASE_TEAMS || "";
                const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

                if (!teamsUrl) {
                    throw new Error("NEXT_PUBLIC_SUPABASE_TEAMS is not set");
                }

                if (!anonKey) {
                    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
                }

                const response = await fetch(teamsUrl, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${anonKey}`,
                        "Content-Type": "application/json",
                        apikey: anonKey,
                    },
                });

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch teams: ${response.status}`,
                    );
                }

                const result =
                    (await response.json()) as ParticipantTeamResponse;

                if (isMounted) {
                    setTeams(result.data || {});
                    setMonth(result.month || "");
                }
            } catch (err) {
                if (isMounted) {
                    console.error("Failed to fetch participant teams:", err);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to fetch teams",
                    );
                    setTeams({});
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchTeams();

        return () => {
            isMounted = false;
        };
    }, []);

    return { teams, month, loading, error };
}
