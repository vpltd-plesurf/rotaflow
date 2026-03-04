"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { LeaveRequestWithEmployee } from "@/lib/supabase/types";

const schema = z
  .object({
    startDate: z.string().min(1, "Start date required"),
    endDate: z.string().min(1, "End date required"),
    reason: z.string().optional().default(""),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

interface LeaveRequestFormProps {
  employeeId: string;
  onSuccess: (request: LeaveRequestWithEmployee) => void;
  onCancel: () => void;
}

export function LeaveRequestForm({ employeeId, onSuccess, onCancel }: LeaveRequestFormProps) {
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        employee_id: employeeId,
        start_date: values.startDate,
        end_date: values.endDate,
        reason: values.reason || null,
        status: "pending",
      })
      .select(`
        *,
        employee:profiles!leave_requests_employee_id_fkey(id, full_name, location_id),
        reviewer:profiles!leave_requests_reviewed_by_fkey(id, full_name)
      `)
      .single();

    if (error) throw error;

    // Notify managers via API
    await fetch("/api/leave/notify-managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveRequestId: data.id }),
    });

    onSuccess(data as LeaveRequestWithEmployee);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>First day off</Label>
          <Input type="date" {...register("startDate")} />
          {errors.startDate && (
            <p className="text-xs text-destructive">{errors.startDate.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Last day off</Label>
          <Input type="date" {...register("endDate")} />
          {errors.endDate && (
            <p className="text-xs text-destructive">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Reason <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea placeholder="Brief reason for the request…" rows={2} {...register("reason")} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}
