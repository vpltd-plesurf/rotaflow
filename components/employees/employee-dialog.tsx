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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Location, UserRole } from "@/lib/supabase/types";

const schema = z.object({
  fullName: z.string().min(2, "Name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional().default(""),
  locationId: z.string().min(1, "Location required"),
  hourlyRate: z.string().optional().default(""),
  emergencyContactName: z.string().optional().default(""),
  emergencyContactPhone: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

type FormValues = z.infer<typeof schema>;

type EmployeeWithDetail = {
  id: string;
  full_name: string;
  phone: string | null;
  location_id: string | null;
  hourly_rate: number | null;
  detail: {
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    notes: string | null;
    status: "active" | "inactive";
  } | null;
};

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeWithDetail | null;
  locations: Location[];
  currentUserRole: UserRole;
  orgId: string;
  onSaved: (employee: never) => void;
}

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  locations,
  currentUserRole,
  orgId,
  onSaved,
}: EmployeeDialogProps) {
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const locationId = watch("locationId");

  useEffect(() => {
    if (open) {
      if (employee) {
        reset({
          fullName: employee.full_name,
          email: "", // can't read auth email here easily; show placeholder
          phone: employee.phone ?? "",
          locationId: employee.location_id ?? "",
          hourlyRate: employee.hourly_rate?.toString() ?? "",
          emergencyContactName: employee.detail?.emergency_contact_name ?? "",
          emergencyContactPhone: employee.detail?.emergency_contact_phone ?? "",
          notes: employee.detail?.notes ?? "",
        });
      } else {
        reset({
          fullName: "",
          email: "",
          phone: "",
          locationId: "",
          hourlyRate: "",
          emergencyContactName: "",
          emergencyContactPhone: "",
          notes: "",
        });
      }
    }
  }, [open, employee, reset]);

  async function onSubmit(values: FormValues) {
    try {
      if (employee) {
        // Update existing profile
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: values.fullName,
            phone: values.phone || null,
            location_id: values.locationId,
            hourly_rate: values.hourlyRate ? parseFloat(values.hourlyRate) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", employee.id);
        if (profileError) throw profileError;

        const { error: detailError } = await supabase
          .from("employee_details")
          .update({
            emergency_contact_name: values.emergencyContactName || null,
            emergency_contact_phone: values.emergencyContactPhone || null,
            notes: values.notes || null,
          })
          .eq("id", employee.id);
        if (detailError) throw detailError;

        toast({ title: "Barber updated" });

        // Return updated employee data
        const { data: updated } = await supabase
          .from("profiles")
          .select("*, location:locations(*), detail:employee_details(*)")
          .eq("id", employee.id)
          .single();
        onSaved(updated as never);
      } else {
        // Create new auth user + profile
        // The handle_new_user() trigger auto-inserts a profile with org_id
        // from user_metadata (we pass it explicitly here). We then .update the
        // profile with the remaining fields, and .update employee_details
        // (also auto-created by handle_new_barber_profile trigger).
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: values.email,
          password: Math.random().toString(36).slice(2) + "X1!", // temp password
          email_confirm: true,
          user_metadata: { full_name: values.fullName, org_id: orgId },
        });
        if (authError) throw authError;

        const userId = authData.user.id;

        const { error: profileError } = await supabase.from("profiles").update({
          phone: values.phone || null,
          location_id: values.locationId,
          hourly_rate: values.hourlyRate ? parseFloat(values.hourlyRate) : null,
        }).eq("id", userId);
        if (profileError) throw profileError;

        const { error: detailError } = await supabase.from("employee_details").update({
          emergency_contact_name: values.emergencyContactName || null,
          emergency_contact_phone: values.emergencyContactPhone || null,
          notes: values.notes || null,
        }).eq("id", userId);
        if (detailError) throw detailError;

        toast({ title: "Barber added", description: "They can log in with their email." });

        const { data: created } = await supabase
          .from("profiles")
          .select("*, location:locations(*), detail:employee_details(*)")
          .eq("id", userId)
          .single();
        onSaved(created as never);
      }
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit barber" : "Add barber"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Basic info */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input placeholder="Jane Smith" {...register("fullName")} />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>

            {!employee && (
              <div className="space-y-1">
                <Label>Email (for login)</Label>
                <Input type="email" placeholder="jane@example.com" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input placeholder="07700 900000" {...register("phone")} />
              </div>
              <div className="space-y-1">
                <Label>Rate (£/hr)</Label>
                <Input type="number" step="0.01" placeholder="12.00" {...register("hourlyRate")} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={(v) => setValue("locationId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.filter((l) => l.name !== "Head Office").map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.locationId && <p className="text-xs text-destructive">{errors.locationId.message}</p>}
            </div>
          </div>

          <Separator />

          {/* Emergency contact */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Emergency contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input placeholder="Contact name" {...register("emergencyContactName")} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input placeholder="07700 900001" {...register("emergencyContactPhone")} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-1">
            <Label>Private notes <span className="text-muted-foreground">(manager only)</span></Label>
            <Textarea placeholder="Any notes about this barber…" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : employee ? "Save changes" : "Add barber"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
