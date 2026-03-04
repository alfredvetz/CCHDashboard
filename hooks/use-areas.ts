import { useState, useEffect } from "react";

/** Response from Areas edge function */
interface AreasApiResponse {
    count: number;
    areas: { uuid: string; name: string }[];
}

/** Area item with non-null Area name (guaranteed by API) */
export interface AreaItem {
    UUID: string;
    Area: string;
}

/**
 * Hook to fetch available areas from the Areas edge function.
 * Returns areas in the format expected by components ({ UUID, Area }).
 */
export function useAreas() {
    const [areas, setAreas] = useState<AreaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAreas = async () => {
            setLoading(true);
            setError(null);
            try {
                // Use preview project endpoint
                const areasUrl =
                    process.env.NEXT_PUBLIC_SUPABASE_AREAS_URL || "";
                // Use preview anon key
                const anonKey =
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW || "";

                if (!anonKey) {
                    throw new Error(
                        "NEXT_PUBLIC_SUPABASE_ANON_KEY_PREVIEW is not set",
                    );
                }

                const response = await fetch(areasUrl, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${anonKey}`,
                        "Content-Type": "application/json",
                        apikey: anonKey,
                    },
                });

                if (response.ok) {
                    const data: AreasApiResponse = await response.json();
                    // Transform the new format (uuid, name) to the expected format (UUID, Area)
                    const transformedAreas = data.areas.map((area) => ({
                        UUID: area.uuid,
                        Area: area.name,
                    }));
                    setAreas(transformedAreas);
                } else {
                    const errorText = await response.text();
                    console.error("Failed to fetch areas:", errorText);
                    setError(errorText);
                    // Use your actual area names as fallback
                    setAreas([
                        { UUID: "area-1", Area: "East & South Melbourne" },
                        { UUID: "area-2", Area: "Gold Coast & Hinterland" },
                        { UUID: "area-3", Area: "Heidi Rickard Counselling" },
                        { UUID: "area-4", Area: "West & North Melbourne" },
                        { UUID: "area-5", Area: "Wollongong & The Illawarra" },
                    ]);
                }
            } catch (err) {
                console.error("Failed to fetch areas:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                // Use your actual area names as fallback
                setAreas([
                    { UUID: "area-1", Area: "East & South Melbourne" },
                    { UUID: "area-2", Area: "Gold Coast & Hinterland" },
                    { UUID: "area-3", Area: "Heidi Rickard Counselling" },
                    { UUID: "area-4", Area: "West & North Melbourne" },
                    { UUID: "area-5", Area: "Wollongong & The Illawarra" },
                ]);
            } finally {
                setLoading(false);
            }
        };
        fetchAreas();
    }, []);

    return { areas, loading, error };
}
