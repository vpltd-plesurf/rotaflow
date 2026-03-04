"use client";

import { cn } from "@/lib/utils";
import type { ShiftWithEmployee } from "@/lib/supabase/types";

interface ShiftCardProps {
  shift: ShiftWithEmployee;
  onClick: () => void;
  canEdit: boolean;
}

const statusStyles: Record<string, string> = {
  scheduled: "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100",
  leave_block: "bg-amber-50 border-amber-200 text-amber-800",
  swap_pending: "bg-purple-50 border-purple-200 text-purple-800",
  cancelled: "bg-gray-50 border-gray-200 text-gray-500 line-through",
};

export function ShiftCard({ shift, onClick, canEdit }: ShiftCardProps) {
  const style = statusStyles[shift.status] ?? statusStyles.scheduled;

  return (
    <button
      onClick={onClick}
      disabled={!canEdit && shift.status !== "leave_block"}
      className={cn(
        "w-full rounded border px-1.5 py-1 text-left text-xs transition-colors",
        style,
        canEdit && "cursor-pointer"
      )}
    >
      <div className="font-medium leading-tight">
        {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
      </div>
      {shift.role_label && (
        <div className="truncate opacity-75">{shift.role_label}</div>
      )}
      {shift.status === "leave_block" && (
        <div className="truncate font-medium">Leave</div>
      )}
      {shift.status === "swap_pending" && (
        <div className="truncate opacity-75">Swap pending</div>
      )}
    </button>
  );
}
