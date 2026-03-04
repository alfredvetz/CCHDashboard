"use client";

import { useMemo } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface AreaItem {
    UUID: string;
    Area: string;
}

export interface FilterBarProps {
    startMonth: string;
    endMonth: string;
    onStartMonthChange: (value: string) => void;
    onEndMonthChange: (value: string) => void;
    selectedAreas: string[];
    onAreasChange: (areas: string[]) => void;
    isFilterLocked: boolean;
    onClearAll: () => void;
    areas: AreaItem[] | null | undefined;
    /** When set, show this label instead of selected areas (e.g. community lead view) */
    areaLabelOverride?: string | null;
}

function formatMonthDisplay(yearMonth: string): string {
    const [year, month] = yearMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function FilterBar({
    startMonth,
    endMonth,
    onStartMonthChange,
    onEndMonthChange,
    selectedAreas,
    onAreasChange,
    isFilterLocked,
    onClearAll,
    areas,
    areaLabelOverride,
}: FilterBarProps) {
    const availableMonths = useMemo(() => {
        const months: { value: string; label: string }[] = [];
        const startDate = new Date(2023, 1, 1);
        const currentDate = new Date();
        const current = new Date(startDate);
        while (current <= currentDate) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, "0");
            months.push({
                value: `${y}-${m}`,
                label: formatMonthDisplay(`${y}-${m}`),
            });
            current.setMonth(current.getMonth() + 1);
        }
        return months.reverse();
    }, []);

    const startMonths = useMemo(() => {
        if (!endMonth) return availableMonths;
        const [endYear, endMonthNum] = endMonth.split("-").map(Number);
        const endVal = endYear * 100 + endMonthNum;
        return availableMonths.filter((month) => {
            const [y, m] = month.value.split("-").map(Number);
            return y * 100 + m <= endVal;
        });
    }, [availableMonths, endMonth]);

    const endMonths = useMemo(() => {
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevVal = prev.getFullYear() * 100 + (prev.getMonth() + 1);
        return availableMonths.filter((month) => {
            const [y, m] = month.value.split("-").map(Number);
            return y * 100 + m <= prevVal;
        });
    }, [availableMonths]);

    const areaDisplayText =
        areaLabelOverride ??
        (selectedAreas.length > 0 ? selectedAreas.join(", ") : "All Areas");

    return (
        <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                    From:
                </Label>
                <Select value={startMonth} onValueChange={onStartMonthChange}>
                    <SelectTrigger className="h-9 text-sm min-w-[140px]">
                        <SelectValue>
                            {formatMonthDisplay(startMonth)}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                        <div className="max-h-[240px] overflow-y-auto">
                            {startMonths.map((month) => (
                                <SelectItem
                                    key={month.value}
                                    value={month.value}
                                    className="text-sm"
                                >
                                    {month.label}
                                </SelectItem>
                            ))}
                        </div>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                    To:
                </Label>
                <Select value={endMonth} onValueChange={onEndMonthChange}>
                    <SelectTrigger className="h-9 text-sm min-w-[140px]">
                        <SelectValue>
                            {formatMonthDisplay(endMonth)}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                        <div className="max-h-[240px] overflow-y-auto">
                            {endMonths.map((month) => (
                                <SelectItem
                                    key={month.value}
                                    value={month.value}
                                    className="text-sm"
                                >
                                    {month.label}
                                </SelectItem>
                            ))}
                        </div>
                    </SelectContent>
                </Select>
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 justify-start gap-2 text-sm"
                        disabled={isFilterLocked}
                        style={
                            isFilterLocked
                                ? { opacity: 0.7, cursor: "not-allowed" }
                                : undefined
                        }
                    >
                        <Filter className="h-4 w-4" />
                        {areaDisplayText}
                        {selectedAreas.length > 0 && !areaLabelOverride && (
                            <Badge
                                variant="secondary"
                                className="ml-auto text-xs"
                            >
                                {selectedAreas.length}
                            </Badge>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2" align="start">
                    <Label className="font-semibold block mb-2 text-sm">
                        Filter Areas
                    </Label>
                    <div className="max-h-60 overflow-y-auto">
                        {areas?.map((area) => (
                            <label
                                key={area.UUID}
                                className="flex items-center cursor-pointer hover:bg-muted/50 rounded p-1"
                            >
                                <Checkbox
                                    checked={selectedAreas.includes(area.Area)}
                                    onCheckedChange={() => {
                                        const next = selectedAreas.includes(
                                            area.Area,
                                        )
                                            ? selectedAreas.filter(
                                                  (a) => a !== area.Area,
                                              )
                                            : [...selectedAreas, area.Area];
                                        onAreasChange(next);
                                    }}
                                    disabled={isFilterLocked}
                                />
                                <span className="text-sm ml-2">
                                    {area.Area}
                                </span>
                            </label>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
            {!isFilterLocked && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    className="h-9 text-sm text-muted-foreground hover:text-foreground"
                >
                    Clear all
                </Button>
            )}
        </div>
    );
}
