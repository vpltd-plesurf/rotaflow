"use client";

import { useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { cn, getWeekDays, fromDbDate } from "@/lib/utils";
import { ShiftCard } from "@/components/rota/shift-card";
import { ShiftDialog } from "@/components/rota/shift-dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ProfileWithLocation, ShiftWithEmployee, WeeklyHours } from "@/lib/supabase/types";

interface WeeklyGridProps {
  employees: ProfileWithLocation[];
  shifts: ShiftWithEmployee[];
  weekStart: string;
  rotaId: string | null;
  locationId: string;
  canEdit: boolean;
  currentUserId: string;
  isBarber: boolean;
  weeklyHours?: WeeklyHours;
  onShiftsChange: (shifts: ShiftWithEmployee[]) => void;
  ensureRota: () => Promise<string>;
}

export function WeeklyGrid({
  employees,
  shifts,
  weekStart,
  rotaId,
  locationId,
  canEdit,
  currentUserId,
  isBarber,
  weeklyHours,
  onShiftsChange,
  ensureRota,
}: WeeklyGridProps) {
  const supabase = createClient();
  const weekDays = getWeekDays(fromDbDate(weekStart));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftWithEmployee | null>(null);
  const [newShiftContext, setNewShiftContext] = useState<{ employeeId: string; date: string } | null>(null);

  function getShiftsFor(employeeId: string, date: Date): ShiftWithEmployee[] {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts.filter(
      (s) => s.employee_id === employeeId && s.date === dateStr
    );
  }

  function openNew(employeeId: string, date: Date) {
    if (!canEdit) return;
    setEditingShift(null);
    setNewShiftContext({ employeeId, date: format(date, "yyyy-MM-dd") });
    setDialogOpen(true);
  }

  function openEdit(shift: ShiftWithEmployee) {
    if (!canEdit) return;
    setEditingShift(shift);
    setNewShiftContext(null);
    setDialogOpen(true);
  }

  async function handleSave(data: {
    employeeId: string;
    date: string;
    startTime: string;
    endTime: string;
    roleLabel: string;
    notes: string;
  }) {
    try {
      const rid = await ensureRota();

      if (editingShift) {
        const { data: updated, error } = await supabase
          .from("shifts")
          .update({
            start_time: data.startTime,
            end_time: data.endTime,
            role_label: data.roleLabel || null,
            notes: data.notes || null,
          })
          .eq("id", editingShift.id)
          .select("*, employee:profiles(*)")
          .single();
        if (error) throw error;
        onShiftsChange(
          shifts.map((s) => (s.id === editingShift.id ? (updated as ShiftWithEmployee) : s))
        );
        toast({ title: "Shift updated" });
      } else {
        const { data: created, error } = await supabase
          .from("shifts")
          .insert({
            rota_id: rid,
            employee_id: data.employeeId,
            date: data.date,
            start_time: data.startTime,
            end_time: data.endTime,
            role_label: data.roleLabel || null,
            notes: data.notes || null,
            status: "scheduled",
          })
          .select("*, employee:profiles(*)")
          .single();
        if (error) throw error;
        onShiftsChange([...shifts, created as ShiftWithEmployee]);
        toast({ title: "Shift added" });
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    }
  }

  async function handleDelete(shiftId: string) {
    try {
      const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
      if (error) throw error;
      onShiftsChange(shifts.filter((s) => s.id !== shiftId));
      toast({ title: "Shift removed" });
      setDialogOpen(false);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    }
  }

  // For barber: only show their own row
  const visibleEmployees = isBarber
    ? employees.filter((e) => e.id === currentUserId)
    : employees;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="w-32 border-r px-3 py-2 text-left font-medium text-muted-foreground">
              Barber
            </th>
            {weekDays.map((day) => (
              <th
                key={day.toISOString()}
                className={cn(
                  "border-r px-2 py-2 text-center font-medium last:border-r-0",
                  format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                    ? "bg-primary/5 text-primary"
                    : "text-muted-foreground"
                )}
              >
                <div>{format(day, "EEE")}</div>
                <div className="text-xs font-normal">{format(day, "d MMM")}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleEmployees.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-muted-foreground">
                No barbers found for this location.
              </td>
            </tr>
          )}
          {visibleEmployees.map((employee, rowIdx) => (
            <tr
              key={employee.id}
              className={cn(
                "border-b last:border-b-0",
                rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20"
              )}
            >
              <td className="border-r px-3 py-2 font-medium whitespace-nowrap">
                {employee.full_name}
              </td>
              {weekDays.map((day) => {
                const dayShifts = getShiftsFor(employee.id, day);
                return (
                  <td
                    key={day.toISOString()}
                    className="border-r px-1 py-1 align-top last:border-r-0"
                    style={{ minWidth: 90, minHeight: 60 }}
                  >
                    <div className="flex flex-col gap-0.5">
                      {dayShifts.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          onClick={() => openEdit(shift)}
                          canEdit={canEdit}
                        />
                      ))}
                      {canEdit && dayShifts.length === 0 && (
                        <button
                          onClick={() => openNew(employee.id, day)}
                          className="flex h-10 w-full items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEdit && dayShifts.length > 0 && (
                        <button
                          onClick={() => openNew(employee.id, day)}
                          className="flex h-5 w-full items-center justify-center rounded text-muted-foreground opacity-0 hover:opacity-100 hover:text-primary transition-opacity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ShiftDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        shift={editingShift}
        employees={employees}
        defaultEmployeeId={newShiftContext?.employeeId}
        defaultDate={newShiftContext?.date}
        weeklyHours={weeklyHours}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
