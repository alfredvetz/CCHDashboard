"use client";

import { useMemo, useCallback, useRef, useEffect } from "react";
import {
    format,
    parseISO,
    addDays,
    isWithinInterval,
    isSameDay,
} from "date-fns";
import { Calendar, Clock, User, X } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStaff } from "@/hooks/use-staff";
import {
    useTBAShifts,
    useStaffShifts,
    type RosterShift,
} from "@/hooks/use-roster";
import { useParticipantTeams } from "@/hooks/use-participant-teams";
import { useParticipants } from "@/hooks/use-participants";

interface StaffTBAShiftsProps {
    staffName: string;
    onClose?: () => void;
}

export function StaffTBAShifts({ staffName, onClose }: StaffTBAShiftsProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Force width constraints on every render
    useEffect(() => {
        if (containerRef.current) {
            const element = containerRef.current;
            element.style.width = "100%";
            element.style.maxWidth = "100%";
            element.style.overflowX = "hidden";
            element.style.boxSizing = "border-box";
        }
    });

    // Fetch participant teams data
    const { teams: participantTeams } = useParticipantTeams();
    const { participants: participantsData } = useParticipants();
    const { staff: allStaff } = useStaff();

    // Get date range: today to 2 weeks from now
    const today = new Date();
    const twoWeeksFromNow = addDays(today, 14);
    const startDate = format(today, "yyyy-MM-dd");
    const endDate = format(twoWeeksFromNow, "yyyy-MM-dd");

    // Fetch TBA shifts from database
    const { shifts: allTBAShifts, loading: shiftsLoading } = useTBAShifts({
        startDate,
        endDate,
        cancelled: false,
    });

    // Fetch staff member's assigned shifts for conflict checking
    const { shifts: staffAssignedShifts } = useStaffShifts(staffName, {
        startDate,
        endDate,
        cancelled: false,
    });

    // Find the staff member's phone number
    const staffMember = useMemo(() => {
        return allStaff.find(
            (s) =>
                s.full_name?.toLowerCase().trim() ===
                staffName.toLowerCase().trim(),
        );
    }, [allStaff, staffName]);

    // Create a mapping from participant name to their team
    const participantNameToTeam = useMemo(() => {
        const mapping: Record<string, string[]> = {};

        participantsData.forEach((participant) => {
            const team = participantTeams[participant.UID] || [];
            if (participant.clientFullName) {
                mapping[participant.clientFullName] = team;
            }
        });

        console.log("[StaffTBAShifts] Participant to team mapping:", {
            totalParticipants: participantsData.length,
            totalMappings: Object.keys(mapping).length,
            sampleMapping: Object.entries(mapping).slice(0, 3),
        });

        return mapping;
    }, [participantsData, participantTeams]);

    // Helper function to check staff availability
    // Checks against staff's assigned shifts from the database
    const checkStaffAvailability = useCallback(
        (
            shiftDate: Date,
            shiftStartTime: string,
            shiftEndTime: string,
            staffShifts: RosterShift[],
        ): {
            status: "available" | "tight" | "conflict";
            gapMinutes?: number;
        } => {
            const parseTime = (
                timeStr: string,
            ): { hours: number; minutes: number } => {
                // Handle both HH:mm:ss and 12-hour format
                const match = timeStr.match(
                    /(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i,
                );
                if (!match) return { hours: 0, minutes: 0 };

                let hours = parseInt(match[1]);
                const minutes = parseInt(match[2]);
                const meridiem = match[4]?.toUpperCase();

                if (meridiem === "PM" && hours !== 12) hours += 12;
                if (meridiem === "AM" && hours === 12) hours = 0;

                return { hours, minutes };
            };

            const currentStart = parseTime(shiftStartTime);
            const currentEnd = parseTime(shiftEndTime);

            // Filter staff shifts to same date
            const shiftsOnSameDate = staffShifts.filter((shift) => {
                try {
                    const shiftDate2 = parseISO(shift.shift_date);
                    return isSameDay(shiftDate, shiftDate2);
                } catch {
                    return false;
                }
            });

            let minGapMinutes: number | undefined = undefined;

            for (const shift of shiftsOnSameDate) {
                const shiftStart = parseTime(shift.start_time);
                const shiftEnd = parseTime(shift.end_time);

                const currentStartMins =
                    currentStart.hours * 60 + currentStart.minutes;
                const currentEndMins =
                    currentEnd.hours * 60 + currentEnd.minutes;
                const shiftStartMins =
                    shiftStart.hours * 60 + shiftStart.minutes;
                const shiftEndMins = shiftEnd.hours * 60 + shiftEnd.minutes;

                // Check for direct overlap
                if (
                    currentStartMins < shiftEndMins &&
                    currentEndMins > shiftStartMins
                ) {
                    return { status: "conflict" };
                }

                // Check for tight timing (within 1 hour)
                if (
                    shiftEndMins <= currentStartMins &&
                    currentStartMins - shiftEndMins <= 60
                ) {
                    const gapMins = currentStartMins - shiftEndMins;
                    if (
                        minGapMinutes === undefined ||
                        gapMins < minGapMinutes
                    ) {
                        minGapMinutes = gapMins;
                    }
                }

                if (
                    shiftStartMins >= currentEndMins &&
                    shiftStartMins - currentEndMins <= 60
                ) {
                    const gapMins = shiftStartMins - currentEndMins;
                    if (
                        minGapMinutes === undefined ||
                        gapMins < minGapMinutes
                    ) {
                        minGapMinutes = gapMins;
                    }
                }
            }

            if (minGapMinutes !== undefined) {
                return { status: "tight", gapMinutes: minGapMinutes };
            }

            return { status: "available" };
        },
        [],
    );

    // Filter TBA shifts for this staff member based on participant teams
    const availableShifts = useMemo(() => {
        if (shiftsLoading) return [];

        console.log(
            "[StaffTBAShifts] Processing",
            allTBAShifts.length,
            "TBA shifts for staff:",
            staffName,
        );

        // Filter for shifts where the staff member is in any of the participants' teams
        const relevantShifts = allTBAShifts.filter((shift) => {
            // Check if the staff member is in any of the participants' teams
            if (!shift.participants || shift.participants.length === 0) {
                console.log(
                    "[StaffTBAShifts] Skipping shift - no participants:",
                    shift.shift_id,
                );
                return false;
            }

            // If no team data is available, show all TBA shifts (the user can manually check)
            const hasTeamData = Object.keys(participantNameToTeam).length > 0;
            if (!hasTeamData) {
                console.log(
                    "[StaffTBAShifts] No team data available - showing all TBA shifts",
                );
                return true;
            }

            const isInTeam = shift.participants.some((participantName) => {
                const team = participantNameToTeam[participantName] || [];
                if (team.length === 0) {
                    console.log(
                        "[StaffTBAShifts] No team data for participant:",
                        participantName,
                    );
                }
                // Case-insensitive matching for staff names
                const match = team.some(
                    (teamMember) =>
                        teamMember.toLowerCase().trim() ===
                        staffName.toLowerCase().trim(),
                );
                if (match) {
                    console.log(
                        "[StaffTBAShifts] ✅ Staff found in team for participant:",
                        participantName,
                    );
                }
                return match;
            });

            return isInTeam;
        });

        console.log(
            "[StaffTBAShifts] Relevant shifts (TBA + in team):",
            relevantShifts.length,
        );

        // Check availability for the staff member using their assigned shifts
        const availableForStaff = relevantShifts.filter((shift) => {
            const shiftDate = parseISO(shift.shift_date);
            const availability = checkStaffAvailability(
                shiftDate,
                shift.start_time,
                shift.end_time,
                staffAssignedShifts,
            );
            // Only show shifts where staff is available or has tight schedule (not conflicting)
            return availability.status !== "conflict";
        });

        console.log(
            "[StaffTBAShifts] Available shifts (no conflicts):",
            availableForStaff.length,
        );

        // Sort by date
        const sorted = availableForStaff.sort((a, b) => {
            const dateA = parseISO(a.shift_date);
            const dateB = parseISO(b.shift_date);
            return dateA.getTime() - dateB.getTime();
        });

        console.log("[StaffTBAShifts] Final sorted shifts:", sorted.length);
        return sorted;
    }, [
        allTBAShifts,
        shiftsLoading,
        staffName,
        participantNameToTeam,
        staffAssignedShifts,
        checkStaffAvailability,
    ]);

    // Create pre-filled message template for a shift

    if (shiftsLoading) {
        return (
            <div
                ref={containerRef}
                className="w-full max-w-full min-w-0 overflow-x-hidden box-border"
                style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}
            >
                <Card
                    className="w-full max-w-full min-w-0 overflow-x-hidden box-border !gap-2 !border-0"
                    style={{
                        width: "100%",
                        maxWidth: "100%",
                        overflowX: "hidden",
                        boxSizing: "border-box",
                        gap: "0.5rem",
                    }}
                >
                    <CardHeader className="pb-1 px-1 pt-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-sm font-medium truncate">
                                    Available TBA Shifts
                                </CardTitle>
                            </div>
                            {onClose && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="flex-shrink-0 h-8 w-8"
                                    title="Close"
                                    aria-label="Close"
                                >
                                    <X className="h-3 w-3 text-muted-foreground" />
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="px-1 pt-1 pb-0">
                        <p className="text-sm text-muted-foreground">
                            Loading shifts...
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (availableShifts.length === 0) {
        return (
            <div
                ref={containerRef}
                className="w-full max-w-full min-w-0 overflow-x-hidden box-border"
                style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}
            >
                <Card
                    className="w-full max-w-full min-w-0 overflow-x-hidden box-border !gap-2 !border-0"
                    style={{
                        width: "100%",
                        maxWidth: "100%",
                        overflowX: "hidden",
                        boxSizing: "border-box",
                        gap: "0.5rem",
                    }}
                >
                    <CardHeader className="pb-1 px-1 pt-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-sm font-medium truncate">
                                    Available TBA Shifts
                                </CardTitle>
                            </div>
                            {onClose && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="flex-shrink-0 h-8 w-8"
                                    title="Close"
                                    aria-label="Close"
                                >
                                    <X className="h-3 w-3 text-muted-foreground" />
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="px-1 pt-1 pb-0">
                        <p className="text-sm text-muted-foreground">
                            No available TBA shifts in the next 2 weeks
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full max-w-full min-w-0 overflow-x-hidden box-border"
            style={{
                width: "100%",
                maxWidth: "100%",
                overflowX: "hidden",
                boxSizing: "border-box",
            }}
        >
            <Card
                className="w-full max-w-full min-w-0 overflow-x-hidden box-border !gap-2 flex flex-col border-0"
                style={{
                    width: "100%",
                    maxWidth: "100%",
                    overflowX: "hidden",
                    boxSizing: "border-box",
                    gap: "0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    flexShrink: 1,
                    flexBasis: "auto",
                }}
            >
                <CardHeader
                    className="pb-1 px-1 pt-2 min-w-0 max-w-full overflow-x-hidden"
                    style={{
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        overflowX: "hidden",
                        minWidth: 0,
                    }}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium truncate">
                                Available TBA Shifts
                            </CardTitle>
                        </div>
                        {onClose && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="flex-shrink-0 h-8 w-8"
                                title="Close"
                                aria-label="Close"
                            >
                                <X className="h-3 w-3 text-muted-foreground" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent
                    className="px-1 pt-1 pb-0 min-w-0 max-w-full overflow-x-hidden"
                    style={{
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        overflowX: "hidden",
                        minWidth: 0,
                        flexShrink: 1,
                    }}
                >
                    <div
                        className="space-y-1 max-h-[300px] overflow-y-auto min-w-0 w-full"
                        style={{
                            width: "100%",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                            overflowX: "hidden",
                            minWidth: 0,
                        }}
                    >
                        {availableShifts.map((shift) => {
                            const shiftDate = parseISO(shift.shift_date);
                            const availability = checkStaffAvailability(
                                shiftDate,
                                shift.start_time,
                                shift.end_time,
                                staffAssignedShifts,
                            );

                            // Format time from HH:mm:ss to 12-hour format
                            const formatTime = (timeStr: string): string => {
                                const [hours, minutes] = timeStr.split(":");
                                const hour = parseInt(hours);
                                const ampm = hour >= 12 ? "PM" : "AM";
                                const displayHour =
                                    hour === 0
                                        ? 12
                                        : hour > 12
                                          ? hour - 12
                                          : hour;
                                return `${displayHour}:${minutes} ${ampm}`;
                            };

                            return (
                                <div
                                    key={shift.id}
                                    className="px-1 py-2 rounded-md space-y-1.5 hover:bg-muted/50 transition-colors text-xs min-w-0 max-w-full overflow-x-hidden w-full box-border"
                                    style={{
                                        width: "100%",
                                        maxWidth: "100%",
                                        overflowX: "hidden",
                                        boxSizing: "border-box",
                                        wordBreak: "break-word",
                                        overflowWrap: "break-word",
                                        tableLayout: "fixed",
                                    }}
                                >
                                    <div
                                        className="flex items-start justify-between gap-1.5 min-w-0 w-full"
                                        style={{
                                            width: "100%",
                                            maxWidth: "100%",
                                            minWidth: 0,
                                        }}
                                    >
                                        <div
                                            className="space-y-0.5 flex-1 min-w-0 overflow-x-hidden"
                                            style={{
                                                minWidth: 0,
                                                maxWidth: "100%",
                                                overflowX: "hidden",
                                            }}
                                        >
                                            <div
                                                className="flex items-center gap-1.5 min-w-0"
                                                style={{
                                                    minWidth: 0,
                                                    maxWidth: "100%",
                                                }}
                                            >
                                                <User className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                                <span
                                                    className="font-medium text-xs truncate block min-w-0"
                                                    style={{
                                                        minWidth: 0,
                                                        maxWidth: "100%",
                                                        overflowX: "hidden",
                                                        textOverflow:
                                                            "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {shift.participants &&
                                                    shift.participants.length >
                                                        0
                                                        ? shift.participants.join(
                                                              ", ",
                                                          )
                                                        : "No client"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                                <span>
                                                    {format(
                                                        shiftDate,
                                                        "EEE, MMM d",
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3 flex-shrink-0" />
                                                <span>
                                                    {formatTime(
                                                        shift.start_time,
                                                    )}{" "}
                                                    -{" "}
                                                    {formatTime(shift.end_time)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                            {availability.status ===
                                                "available" && (
                                                <Badge
                                                    variant="outline"
                                                    className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0.5"
                                                >
                                                    Available
                                                </Badge>
                                            )}
                                            {availability.status ===
                                                "tight" && (
                                                <Badge
                                                    variant="outline"
                                                    className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0.5"
                                                >
                                                    {availability.gapMinutes !==
                                                    undefined
                                                        ? `${availability.gapMinutes}m`
                                                        : "Tight"}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
