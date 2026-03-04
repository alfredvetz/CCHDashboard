import { useState, useEffect } from "react";

interface ClientRevenueData {
    month_start: string;
    monthly_revenue: string;
}

interface ClientRevenueResponse {
    client_name_input: string;
    end_date: string;
    months: ClientRevenueData[];
}

export const useClientRevenue = (
    clientName: string | null,
    endDate?: string,
) => {
    const [data, setData] = useState<ClientRevenueResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientName) {
            setData(null);
            return;
        }

        const fetchClientRevenue = async () => {
            setLoading(true);
            setError(null);

            try {
                const requestBody: { name: string; end_date?: string } = {
                    name: clientName,
                    ...(endDate && { end_date: endDate }),
                };

                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
                const clientRevenueUrl = supabaseUrl
                    ? `${supabaseUrl}/functions/v1/ClientPrevious6months`
                    : "";
                if (!clientRevenueUrl) {
                    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
                }
                const response = await fetch(clientRevenueUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `Client revenue API error: ${response.status} - ${errorText}`,
                    );
                }

                const result: ClientRevenueResponse = await response.json();
                setData(result);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch client revenue data",
                );
                setData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchClientRevenue();
    }, [clientName, endDate]);

    return { data, loading, error };
};
