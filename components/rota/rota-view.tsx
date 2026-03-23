"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, Send, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeeklyGrid } from "@/components/rota/weekly-grid";
import { getWeekStart, toDbDate, formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type {
  ProfileWithLocation,
  Location,
  Rota,
  ShiftWithEmployee,
  WeeklyHours,
} from "@/lib/supabase/types";

interface RotaViewProps {
  profile: ProfileWithLocation;
  locations: Location[];
  employees: ProfileWithLocation[];
  rota: Rota | null;
  shifts: ShiftWithEmployee[];
  weekStart: string;
  locationId: string | null;
  weeklyHours?: WeeklyHours;
}

export function RotaView({
  profile,
  locations,
  employees,
  rota,
  shifts: initialShifts,
  weekStart,
  locationId,
  weeklyHours,
}: RotaViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>(initialShifts);
  const [publishing, setPublishing] = useState(false);
  const [copying, setCopying] = useState(false);

  const weekDate = new Date(weekStart + "T00:00:00");
  const weekEnd = format(addWeeks(weekDate, 1), "yyyy-MM-dd");

  const canEdit = profile.role === "admin" || profile.role === "manager";

  function navigateWeek(direction: "prev" | "next") {
    const newWeek = direction === "prev"
      ? subWeeks(weekDate, 1)
      : addWeeks(weekDate, 1);
    const params = new URLSearchParams();
    params.set("week", toDbDate(newWeek));
    if (locationId) params.set("location", locationId);
    router.push(`/dashboard/rota?${params.toString()}`);
  }

  function switchLocation(id: string) {
    const params = new URLSearchParams();
    params.set("week", weekStart);
    params.set("location", id);
    router.push(`/dashboard/rota?${params.toString()}`);
  }

  async function ensureRota(): Promise<string> {
    if (rota) return rota.id;
    const { data, error } = await supabase
      .from("rotas")
      .insert({
        location_id: locationId!,
        week_start: weekStart,
        published: false,
        created_by: profile.id,
      })
      .select()
      .single();
    if (error) throw error;
    router.refresh();
    return data.id;
  }

  async function handlePublish() {
    if (!rota) return;
    setPublishing(true);
    try {
      const { error } = await supabase
        .from("rotas")
        .update({ published: true, published_at: new Date().toISOString() })
        .eq("id", rota.id);
      if (error) throw error;

      // Trigger email notifications via API route
      await fetch("/api/rota/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotaId: rota.id }),
      });

      toast({ title: "Rota published", description: "Barbers have been notified by email." });
      router.refresh();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopyPreviousWeek() {
    if (!locationId) return;
    setCopying(true);
    try {
      const prevWeekStart = toDbDate(subWeeks(weekDate, 1));

      // Find previous week's rota
      const { data: prevRota } = await supabase
        .from("rotas")
        .select("id")
        .eq("location_id", locationId)
        .eq("week_start", prevWeekStart)
        .maybeSingle();

      if (!prevRota) {
        toast({ variant: "destructive", title: "No previous rota", description: "There is no rota for last week to copy." });
        return;
      }

      // Get previous week's shifts
      const { data: prevShifts } = await supabase
        .from("shifts")
        .select("*")
        .eq("rota_id", prevRota.id)
        .eq("status", "scheduled");

      if (!prevShifts?.length) {
        toast({ variant: "destructive", title: "No shifts to copy", description: "Previous week has no scheduled shifts." });
        return;
      }

      // Ensure this week's rota exists
      const thisRotaId = await ensureRota();

      // Copy shifts offset by 7 days
      const newShifts = prevShifts.map((s) => {
        const prevDate = new Date(s.date + "T00:00:00");
        const newDate = toDbDate(addWeeks(prevDate, 1));
        return {
          rota_id: thisRotaId,
          employee_id: s.employee_id,
          date: newDate,
          start_time: s.start_time,
          end_time: s.end_time,
          role_label: s.role_label,
          notes: s.notes,
          status: "scheduled" as const,
        };
      });

      const { error } = await supabase.from("shifts").insert(newShifts);
      if (error) throw error;

      toast({ title: "Week copied", description: `${newShifts.length} shifts copied from last week.` });
      router.refresh();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setCopying(false);
    }
  }

  // Calculate indicative cost
  const totalCost = shifts.reduce((sum, s) => {
    if (s.status !== "scheduled") return sum;
    const rate = s.employee?.hourly_rate ?? 0;
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    return sum + hours * rate;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-fit text-center">
            <p className="text-sm font-medium">
              {format(weekDate, "d MMM")} – {format(addWeeks(weekDate, 1), "d MMM yyyy")}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Location switcher (admin only) */}
        {profile.role === "admin" && (
          <Select value={locationId ?? ""} onValueChange={switchLocation}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {rota && (
          <Badge variant={rota.published ? "success" : "outline"}>
            {rota.published ? "Published" : "Draft"}
          </Badge>
        )}

        {totalCost > 0 && (
          <span className="text-sm text-muted-foreground">
            Est. cost: <strong>{formatCurrency(totalCost)}</strong>
          </span>
        )}

        {/* Actions */}
        {canEdit && locationId && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyPreviousWeek} disabled={copying}>
              <Copy className="h-4 w-4" />
              {copying ? "Copying…" : "Copy last week"}
            </Button>
            {rota && !rota.published && (
              <Button size="sm" onClick={handlePublish} disabled={publishing}>
                <Send className="h-4 w-4" />
                {publishing ? "Publishing…" : "Publish rota"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* No location selected (admin) */}
      {!locationId && profile.role === "admin" && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Select a location above to view or edit its rota.
        </div>
      )}

      {locationId && (
        <WeeklyGrid
          employees={employees}
          shifts={shifts}
          weekStart={weekStart}
          rotaId={rota?.id ?? null}
          locationId={locationId}
          canEdit={canEdit}
          currentUserId={profile.id}
          isBarber={profile.role === "barber"}
          weeklyHours={weeklyHours}
          onShiftsChange={setShifts}
          ensureRota={ensureRota}
        />
      )}
    </div>
  );
}
