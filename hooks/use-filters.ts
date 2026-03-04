import { Period } from "@/types/dashboard.types";
import { useState, useEffect } from "react";

interface UseFiltersOptions {
    initialSelectedAreas?: string[];
    isFilterLocked?: boolean;
}

interface ChartDataPoint {
    bucket?: string;
    month?: string;
    date?: string;
}

const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getPreviousMonth = () => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
};

const getStartOfYear = () => {
    const now = new Date();
    return `${now.getFullYear()}-01`;
};

const getTwelveMonthsBefore = (yearMonth: string) => {
    const [year, month] = yearMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 12);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getDefaultStartMonth = () => {
    const endMonth = getPreviousMonth();
    return getTwelveMonthsBefore(endMonth);
};

function startOfMonthISO(iso: string): string {
    const [y, m] = iso.slice(0, 7).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
}

function firstOfNextMonthISO(iso: string): string {
    const [y, m] = iso.slice(0, 7).split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

const monthToDateRange = (yearMonth: string) => {
    const fromDate = startOfMonthISO(yearMonth);
    const toDate = firstOfNextMonthISO(yearMonth);

    return {
        fromDate,
        toDate,
    };
};

const navigateMonth = (currentMonth: string, direction: "prev" | "next") => {
    const [year, month] = currentMonth.split("-").map(Number);

    if (direction === "prev") {
        if (month === 1) {
            return `${year - 1}-12`;
        } else {
            return `${year}-${String(month - 1).padStart(2, "0")}`;
        }
    } else {
        if (month === 12) {
            return `${year + 1}-01`;
        } else {
            return `${year}-${String(month + 1).padStart(2, "0")}`;
        }
    }
};

export const useFilters = (options?: UseFiltersOptions) => {
    const { initialSelectedAreas = [], isFilterLocked = false } = options || {};
    const [startMonth, setStartMonth] = useState(getDefaultStartMonth);
    const [endMonth, setEndMonth] = useState(getPreviousMonth);
    const [period, setPeriod] = useState<Period>("monthly");
    const [selectedAreas, setSelectedAreas] =
        useState<string[]>(initialSelectedAreas);

    useEffect(() => {
        const sync = () => setSelectedAreas(initialSelectedAreas);
        queueMicrotask(sync);
    }, [initialSelectedAreas, isFilterLocked]);

    const fromDate = startOfMonthISO(startMonth);
    const toDate = firstOfNextMonthISO(endMonth);

    const goToPreviousStartMonth = () => {
        setStartMonth((prev) => navigateMonth(prev, "prev"));
    };

    const goToNextStartMonth = () => {
        setStartMonth((prev) => navigateMonth(prev, "next"));
    };

    const goToPreviousEndMonth = () => {
        setEndMonth((prev) => navigateMonth(prev, "prev"));
    };

    const goToNextEndMonth = () => {
        setEndMonth((prev) => navigateMonth(prev, "next"));
    };

    const goToStartMonth = (yearMonth: string) => {
        setStartMonth(yearMonth);
    };

    const goToEndMonth = (yearMonth: string) => {
        setEndMonth(yearMonth);
    };

    const handleChartPointClick = (dataPoint: ChartDataPoint) => {
        let yearMonth = "";

        if (dataPoint.bucket) {
            yearMonth = dataPoint.bucket.substring(0, 7);
        } else if (dataPoint.month) {
            yearMonth = dataPoint.month;
        } else if (dataPoint.date) {
            // Format: "2024-01-15" -> "2024-01"
            yearMonth = dataPoint.date.substring(0, 7);
        }

        if (yearMonth) {
            // Update the start month (from date) when clicking on any chart point
            goToStartMonth(yearMonth);
        }
    };

    const handleChartPointClickForEndMonth = (dataPoint: ChartDataPoint) => {
        let yearMonth = "";

        if (dataPoint.bucket) {
            yearMonth = dataPoint.bucket.substring(0, 7);
        } else if (dataPoint.month) {
            yearMonth = dataPoint.month;
        } else if (dataPoint.date) {
            yearMonth = dataPoint.date.substring(0, 7);
        }

        if (yearMonth) {
            goToEndMonth(yearMonth);
        }
    };

    const handleClearAll = () => {
        const defaultEndMonth = getPreviousMonth();
        setStartMonth(getTwelveMonthsBefore(defaultEndMonth));
        setEndMonth(defaultEndMonth);
        setPeriod("monthly");
        setSelectedAreas(isFilterLocked ? initialSelectedAreas : []);
    };

    const setSelectedAreasSafe = (areas: string[]) => {
        if (!isFilterLocked) {
            setSelectedAreas(areas);
        }
    };

    return {
        startMonth,
        endMonth,
        fromDate,
        toDate,
        period,
        selectedAreas,
        isFilterLocked,
        goToPreviousStartMonth,
        goToNextStartMonth,
        goToPreviousEndMonth,
        goToNextEndMonth,
        goToStartMonth,
        goToEndMonth,
        handleChartPointClick,
        handleChartPointClickForEndMonth,
        onPeriodChange: setPeriod,
        onAreasChange: setSelectedAreasSafe,
        handleClearAll,
    };
};
