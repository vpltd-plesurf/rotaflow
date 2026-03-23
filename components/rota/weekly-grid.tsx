"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { Plus, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn, getWeekDays, fromDbDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShiftCard } from "@/components/rota/shift-card";
import { ShiftDialog } from "@/components/rota/shift-dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ProfileWithLocation, ShiftWithEmployee, WeeklyHours } from "@/lib/supabase/types";

type LeaveRange = { employee_id: string; start_date: string; end_date: string };

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
  leaveRequests?: LeaveRange[];
}

/* ---------- Draggable shift wrapper ---------- */
function DraggableShift({
  shift,
  canEdit,
  onEdit,
}: {
  shift: ShiftWithEmployee;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
    disabled: !canEdit || shift.status !== "scheduled",
  });

  return (
    <div
      ref={setNodeRef}
      className={cn("relative group", isDragging && "opacity-30")}
    >
      {canEdit && shift.status === "scheduled" && (
        <div
          {...listeners}
          {...attributes}
          className="absolute -left-0.5 top-1/2 -translate-y-1/2 z-10 cursor-grab opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
      <ShiftCard shift={shift} onClick={onEdit} canEdit={canEdit} />
    </div>
  );
}

/* ---------- Droppable cell wrapper ---------- */
function DroppableCell({
  id,
  children,
  className,
  style,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <td
      ref={setNodeRef}
      className={cn(
        className,
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/30"
      )}
      style={style}
    >
      {children}
    </td>
  );
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
  leaveRequests,
}: WeeklyGridProps) {
  const supabase = createClient();
  const weekDays = getWeekDays(fromDbDate(weekStart));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftWithEmployee | null>(null);
  const [newShiftContext, setNewShiftContext] = useState<{ employeeId: string; date: string } | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftWithEmployee | null>(null);
  const [mobileDayIdx, setMobileDayIdx] = useState(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const idx = weekDays.findIndex((d) => format(d, "yyyy-MM-dd") === today);
    return idx >= 0 ? idx : 0;
  });

  // Check if an employee is on approved leave for a given date
  function isOnLeave(employeeId: string, dateStr: string): boolean {
    if (!leaveRequests?.length) return false;
    return leaveRequests.some(
      (lr) => lr.employee_id === employeeId && lr.start_date <= dateStr && lr.end_date >= dateStr
    );
  }

  // Count how many employees are on leave for a given date
  function leaveCountForDate(dateStr: string): number {
    if (!leaveRequests?.length) return 0;
    const ids = new Set<string>();
    for (const lr of leaveRequests) {
      if (lr.start_date <= dateStr && lr.end_date >= dateStr) {
        ids.add(lr.employee_id);
      }
    }
    return ids.size;
  }

  // Require 8px drag before activating (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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

  /* ---------- Drag and drop handlers ---------- */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const shift = event.active.data.current?.shift as ShiftWithEmployee | undefined;
    if (shift) setActiveShift(shift);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveShift(null);
      const { active, over } = event;
      if (!over) return;

      const shift = active.data.current?.shift as ShiftWithEmployee | undefined;
      if (!shift) return;

      // Drop target ID format: "cell:{employeeId}:{date}"
      const cellId = String(over.id);
      if (!cellId.startsWith("cell:")) return;

      const [, newEmployeeId, newDate] = cellId.split(":");
      if (!newEmployeeId || !newDate) return;

      // No change
      if (shift.employee_id === newEmployeeId && shift.date === newDate) return;

      // Find the new employee profile for optimistic update
      const newEmployee = employees.find((e) => e.id === newEmployeeId);
      if (!newEmployee) return;

      // Optimistic update
      const updatedShifts = shifts.map((s) =>
        s.id === shift.id
          ? { ...s, employee_id: newEmployeeId, date: newDate, employee: newEmployee }
          : s
      );
      onShiftsChange(updatedShifts);

      try {
        const { error } = await supabase
          .from("shifts")
          .update({ employee_id: newEmployeeId, date: newDate })
          .eq("id", shift.id);
        if (error) throw error;
        toast({ title: "Shift moved" });
      } catch (e: unknown) {
        // Revert on error
        onShiftsChange(shifts);
        toast({ variant: "destructive", title: "Error moving shift", description: String(e) });
      }
    },
    [shifts, employees, supabase, onShiftsChange]
  );

  // For barber: only show their own row
  const visibleEmployees = isBarber
    ? employees.filter((e) => e.id === currentUserId)
    : employees;

  const mobileDay = weekDays[mobileDayIdx];

  return (
    <>
      {/* ===== MOBILE: single-day card view (<md) ===== */}
      <div className="md:hidden space-y-3">
        {/* Day picker */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setMobileDayIdx((i) => Math.max(0, i - 1))}
            disabled={mobileDayIdx === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-1 gap-1 overflow-x-auto">
            {weekDays.map((day, idx) => {
              const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setMobileDayIdx(idx)}
                  className={cn(
                    "flex-1 min-w-[40px] rounded-lg py-1.5 text-center text-xs font-medium transition-colors",
                    idx === mobileDayIdx
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div>{format(day, "EEE")}</div>
                  <div className="text-[10px] font-normal">{format(day, "d")}</div>
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setMobileDayIdx((i) => Math.min(6, i + 1))}
            disabled={mobileDayIdx === 6}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day heading */}
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {format(mobileDay, "EEEE d MMMM")}
          </p>
          {(() => {
            const lc = leaveCountForDate(format(mobileDay, "yyyy-MM-dd"));
            return lc > 0 ? (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                {lc} off
              </span>
            ) : null;
          })()}
        </div>

        {/* Employee cards for this day */}
        {visibleEmployees.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No barbers found for this location.
          </div>
        )}

        {visibleEmployees.map((employee) => {
          const dayShifts = getShiftsFor(employee.id, mobileDay);
          const mobileDateStr = format(mobileDay, "yyyy-MM-dd");
          const onLeaveMobile = isOnLeave(employee.id, mobileDateStr);
          return (
            <div key={employee.id} className={cn(
              "rounded-xl border p-3 space-y-2",
              onLeaveMobile ? "bg-amber-50/60 border-amber-200" : "bg-card"
            )}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{employee.full_name}</p>
                {onLeaveMobile && (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">On leave</span>
                )}
              </div>
              {dayShifts.length === 0 && !canEdit && !onLeaveMobile && (
                <p className="text-xs text-muted-foreground">No shift</p>
              )}
              {dayShifts.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  onClick={() => openEdit(shift)}
                  canEdit={canEdit}
                />
              ))}
              {canEdit && (
                <button
                  onClick={() => openNew(employee.id, mobileDay)}
                  className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add shift
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== DESKTOP: table grid with drag-and-drop (md+) ===== */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden md:block overflow-x-auto rounded-lg border">
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
                    {(() => {
                      const lc = leaveCountForDate(format(day, "yyyy-MM-dd"));
                      return lc > 0 ? (
                        <div className="mt-0.5 text-[10px] font-normal text-amber-600">
                          {lc} off
                        </div>
                      ) : null;
                    })()}
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
                    const dateStr = format(day, "yyyy-MM-dd");
                    const dayShifts = getShiftsFor(employee.id, day);
                    const onLeave = isOnLeave(employee.id, dateStr);
                    return (
                      <DroppableCell
                        key={day.toISOString()}
                        id={`cell:${employee.id}:${dateStr}`}
                        className={cn(
                          "border-r px-1 py-1 align-top last:border-r-0 transition-colors",
                          onLeave && "bg-amber-50/80"
                        )}
                        style={{ minWidth: 90, minHeight: 60 }}
                      >
                        <div className="flex flex-col gap-0.5">
                          {onLeave && dayShifts.filter(s => s.status === "leave_block").length === 0 && (
                            <div className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              On leave
                            </div>
                          )}
                          {dayShifts.map((shift) => (
                            <DraggableShift
                              key={shift.id}
                              shift={shift}
                              canEdit={canEdit}
                              onEdit={() => openEdit(shift)}
                            />
                          ))}
                          {canEdit && dayShifts.length === 0 && !onLeave && (
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
                      </DroppableCell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Drag overlay — floating preview of the shift being dragged */}
        <DragOverlay>
          {activeShift && (
            <div className="w-24 opacity-90 shadow-lg rounded">
              <ShiftCard shift={activeShift} onClick={() => {}} canEdit={false} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
    </>
  );
}
