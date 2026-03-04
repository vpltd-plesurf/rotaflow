"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import type { ProfileWithLocation, ShiftWithEmployee, WeeklyHours, DayKey } from "@/lib/supabase/types";
import { DAY_KEYS } from "@/lib/supabase/types";
import { parseISO, getDay } from "date-fns";

const schema = z.object({
  employeeId: z.string().min(1, "Select a barber"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  roleLabel: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

type FormValues = z.infer<typeof schema>;

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftWithEmployee | null;
  employees: ProfileWithLocation[];
  defaultEmployeeId?: string;
  defaultDate?: string;
  weeklyHours?: WeeklyHours;
  onSave: (data: FormValues) => Promise<void>;
  onDelete: (shiftId: string) => Promise<void>;
}

/** Convert "HH:MM" to total minutes since midnight */
function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Convert total minutes since midnight to "HH:MM" */
function fromMins(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Get the DayKey for a "yyyy-MM-dd" date string */
function dayKeyForDate(dateStr: string): DayKey {
  // getDay returns 0=Sun,1=Mon,...,6=Sat
  const idx = getDay(parseISO(dateStr));
  return DAY_KEYS[idx === 0 ? 6 : idx - 1]; // remap: Sun→6, Mon→0 … Sat→5
}

export function ShiftDialog({
  open,
  onOpenChange,
  shift,
  employees,
  defaultEmployeeId,
  defaultDate,
  weeklyHours,
  onSave,
  onDelete,
}: ShiftDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Resolve the active date (editing existing or creating new)
  const activeDate = shift?.date ?? defaultDate;

  // Look up this day's hours from the weekly schedule
  const dayKey = activeDate ? dayKeyForDate(activeDate) : "mon";
  const dayHours = weeklyHours?.[dayKey];
  const shopOpen = dayHours?.closed ? null : (dayHours?.open ?? "09:00");
  const shopClose = dayHours?.closed ? null : (dayHours?.close ?? "17:30");

  useEffect(() => {
    if (open) {
      if (shift) {
        reset({
          employeeId: shift.employee_id,
          date: shift.date,
          startTime: shift.start_time.slice(0, 5),
          endTime: shift.end_time.slice(0, 5),
          roleLabel: shift.role_label ?? "",
          notes: shift.notes ?? "",
        });
      } else {
        reset({
          employeeId: defaultEmployeeId ?? "",
          date: defaultDate ?? "",
          startTime: shopOpen ?? "09:00",
          endTime: shopClose ?? "17:30",
          roleLabel: "",
          notes: "",
        });
      }
    }
  }, [open, shift, defaultEmployeeId, defaultDate, shopOpen, shopClose, reset]);

  // Compute AM/PM split times
  const lunchMins = dayHours?.lunch_mins ?? 30;
  const openMins  = shopOpen  ? toMins(shopOpen)  : toMins("09:00");
  const closeMins = shopClose ? toMins(shopClose) : toMins("17:30");
  const halfWorkingMins = Math.round((closeMins - openMins - lunchMins) / 2);
  const amEndMins   = openMins + halfWorkingMins;
  const pmStartMins = amEndMins + lunchMins;

  function applyPreset(preset: "full" | "am" | "pm") {
    const o = shopOpen  ?? "09:00";
    const c = shopClose ?? "17:30";
    if (preset === "full") {
      setValue("startTime", o);
      setValue("endTime", c);
    } else if (preset === "am") {
      setValue("startTime", o);
      setValue("endTime", fromMins(amEndMins));
    } else {
      setValue("startTime", fromMins(pmStartMins));
      setValue("endTime", c);
    }
  }

  const employeeId = watch("employeeId");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shift ? "Edit shift" : "Add shift"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          {/* Barber */}
          <div className="space-y-1">
            <Label>Barber</Label>
            <Select
              value={employeeId}
              onValueChange={(v) => setValue("employeeId", v)}
              disabled={!!shift}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select barber" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.employeeId && (
              <p className="text-xs text-destructive">{errors.employeeId.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" {...register("date")} disabled={!!shift} />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>

          {/* Quick presets */}
          <div className="space-y-1">
            <Label>Quick select</Label>
            {dayHours?.closed ? (
              <p className="text-xs text-muted-foreground">Shop is closed on this day.</p>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => applyPreset("full")}>
                  Full day
                  <span className="ml-1 text-xs text-muted-foreground">{shopOpen}–{shopClose}</span>
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => applyPreset("am")}>
                  AM
                  <span className="ml-1 text-xs text-muted-foreground">{shopOpen}–{fromMins(amEndMins)}</span>
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => applyPreset("pm")}>
                  PM
                  <span className="ml-1 text-xs text-muted-foreground">{fromMins(pmStartMins)}–{shopClose}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start</Label>
              <Input type="time" {...register("startTime")} />
              {errors.startTime && (
                <p className="text-xs text-destructive">{errors.startTime.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <Input type="time" {...register("endTime")} />
              {errors.endTime && (
                <p className="text-xs text-destructive">{errors.endTime.message}</p>
              )}
            </div>
          </div>

          {/* Role label */}
          <div className="space-y-1">
            <Label>Role / label <span className="text-muted-foreground">(optional)</span></Label>
            <Input placeholder="e.g. Senior Barber" {...register("roleLabel")} />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea placeholder="Any notes for this shift…" rows={2} {...register("notes")} />
          </div>

          <DialogFooter className="gap-2">
            {shift && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDelete(shift.id)}
                disabled={isSubmitting}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save shift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
