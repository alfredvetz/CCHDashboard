"use client";

import { useState, useEffect, useRef } from "react";

export interface StaffItem {
    UID: number;
    full_name: string;
    area_uuid: string | null;
    Area: string | null;
    Suburb: string | null;
    Gender: string | null;
    DOB: string | null;
    MobileNumber: string | null;
    suitability: number | null;
    PayPoint: string | null;
    Hourly: number | null;
}

interface StaffResponse {
    data: StaffItem[];
}

/**
 * Hook to fetch available staff members from the database.
 */
export function useStaff() {
    const [staff, setStaff] = useState<StaffItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isFetchingRef = useRef(false);

    useEffect(() => {
        const fetchStaff = async () => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            setLoading(true);
            setError(null);

            try {
                const staffUrl =
                    process.env.NEXT_PUBLIC_SUPABASE_STAFFDETAILS || "";
                const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

                if (!staffUrl) {
                    throw new Error(
                        "NEXT_PUBLIC_SUPABASE_STAFFDETAILS is not set",
                    );
                }

                if (!anonKey) {
                    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
                }

                console.log("[useStaff] Fetching from:", staffUrl);

                const response = await fetch(staffUrl, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${anonKey}`,
                        "Content-Type": "application/json",
                        apikey: anonKey,
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(
                        "[useStaff] Response error:",
                        response.status,
                        response.statusText,
                        errorText,
                    );
                    throw new Error(
                        `Failed to fetch staff: ${response.status} ${response.statusText}`,
                    );
                }

                const result = await response.json();
                console.log("[useStaff] Response received:", result);

                // Handle response format
                let staffData: StaffItem[] = [];
                if (result && typeof result === "object") {
                    if (Array.isArray(result)) {
                        // Response is directly an array
                        console.log(
                            "[useStaff] Response is array, length:",
                            result.length,
                        );
                        staffData = result;
                    } else if (result.data && Array.isArray(result.data)) {
                        // Response has data property with array
                        console.log(
                            "[useStaff] Response has data array, length:",
                            result.data.length,
                        );
                        staffData = result.data;
                    } else if (result.staff && Array.isArray(result.staff)) {
                        // Response has staff property
                        console.log(
                            "[useStaff] Response has staff array, length:",
                            result.staff.length,
                        );
                        staffData = result.staff;
                    } else {
                        console.warn(
                            "[useStaff] Unexpected response format:",
                            result,
                        );
                        console.warn(
                            "[useStaff] Response keys:",
                            Object.keys(result || {}),
                        );
                    }
                }

                console.log("[useStaff] Final staff count:", staffData.length);
                if (staffData.length > 0) {
                    console.log("[useStaff] First staff member:", staffData[0]);
                }
                setStaff(staffData);
            } catch (err) {
                console.error("Failed to fetch staff:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch staff",
                );
                // Empty fallback
                setStaff([]);
            } finally {
                setLoading(false);
                isFetchingRef.current = false;
            }
        };

        fetchStaff();
    }, []);

    return { staff, loading, error };
}
