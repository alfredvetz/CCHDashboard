export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function getDateRange(preset: string): {
    startDate: string;
    endDate: string;
} {
    const now = new Date();
    const endDate = now.toISOString().split("T")[0];
    let startDate: string;

    switch (preset) {
        case "24h":
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = yesterday.toISOString().split("T")[0];
            break;
        case "7d":
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            startDate = weekAgo.toISOString().split("T")[0];
            break;
        case "30d":
            const monthAgo = new Date(now);
            monthAgo.setDate(monthAgo.getDate() - 30);
            startDate = monthAgo.toISOString().split("T")[0];
            break;
        case "90d":
            const quarterAgo = new Date(now);
            quarterAgo.setDate(quarterAgo.getDate() - 90);
            startDate = quarterAgo.toISOString().split("T")[0];
            break;
        case "12m":
            const yearAgo = new Date(now);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            startDate = yearAgo.toISOString().split("T")[0];
            break;
        default:
            // Default to 90 days
            const defaultStart = new Date(now);
            defaultStart.setDate(defaultStart.getDate() - 90);
            startDate = defaultStart.toISOString().split("T")[0];
    }

    return { startDate, endDate };
}

export function formatCurrencyCompact(amount: number): string {
    return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(amount);
}

export function formatPeriodLabel(bucket: string, period: string): string {
    if (!bucket) return "";
    const date = new Date(bucket);

    switch (period) {
        case "monthly":
            return date.toLocaleDateString("en-AU", {
                month: "short",
                year: "2-digit",
            });
        case "weekly":
        case "fortnightly":
            return date.toLocaleDateString("en-AU", {
                month: "short",
                day: "numeric",
            });
        default:
            return date.toLocaleDateString("en-AU", {
                month: "short",
                year: "2-digit",
            });
    }
}

export function formatPercentage(percent: number): string {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(1)}%`;
}
