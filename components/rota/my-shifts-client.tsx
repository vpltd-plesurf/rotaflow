"use client";

import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { Clock, MapPin, CalendarDays, CalendarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ProfileWithLocation } from "@/lib/supabase/types";

type ShiftWithRota = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  role_label: string | null;
  notes: string | null;
  rota: {
    location_id: string;
    location: { name: string } | null;
  } | null;
};

interface MyShiftsClientProps {
  profile: ProfileWithLocation;
  upcomingShifts: ShiftWithRota[];
  pastShifts: ShiftWithRota[];
}

const statusStyles: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "destructive" | "outline" }> = {
  scheduled: { label: "Scheduled", variant: "default" },
  leave_block: { label: "Leave", variant: "warning" },
  swap_pending: { label: "Swap pending", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function friendlyDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE d MMMM");
}

function ShiftRow({ shift, past }: { shift: ShiftWithRota; past?: boolean }) {
  const status = statusStyles[shift.status] ?? statusStyles.scheduled;
  const locationName = shift.rota?.location?.name;
  const hours = (() => {
    const [sh, sm] = shift.start_time.split(":").map(Number);
    const [eh, em] = shift.end_time.split(":").map(Number);
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  })();

  return (
    <Card className={past ? "opacity-60" : ""}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium">
              {friendlyDate(shift.date)}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                <span className="text-muted-foreground/60">({hours.toFixed(1)}h)</span>
              </span>
              {locationName && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {locationName}
                </span>
              )}
            </div>
            {shift.role_label && (
              <p className="text-xs text-muted-foreground">{shift.role_label}</p>
            )}
            {shift.notes && (
              <p className="text-xs text-muted-foreground italic">{shift.notes}</p>
            )}
          </div>
          <Badge variant={status.variant} className="shrink-0">
            {status.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function MyShiftsClient({ profile, upcomingShifts, pastShifts }: MyShiftsClientProps) {
  const scheduledCount = upcomingShifts.filter((s) => s.status === "scheduled").length;
  const totalHours = upcomingShifts
    .filter((s) => s.status === "scheduled")
    .reduce((sum, s) => {
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Shifts</h1>
        <p className="text-sm text-muted-foreground">
          {scheduledCount} upcoming shift{scheduledCount !== 1 ? "s" : ""}
          {totalHours > 0 && ` · ${totalHours.toFixed(1)} hours`}
        </p>
      </div>

      {/* Upcoming */}
      {upcomingShifts.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Upcoming
          </h2>
          <div className="space-y-2">
            {upcomingShifts.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} />
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No upcoming shifts scheduled.
        </div>
      )}

      {/* Recent past */}
      {pastShifts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <CalendarOff className="h-3.5 w-3.5" />
            Recent
          </h2>
          <div className="space-y-2">
            {pastShifts.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} past />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
