"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ProfileWithLocation, LeaveRequestWithEmployee } from "@/lib/supabase/types";

interface LeavePageClientProps {
  profile: ProfileWithLocation;
  requests: LeaveRequestWithEmployee[];
}

const statusVariant: Record<string, "outline" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  approved: "success",
  denied: "destructive",
};

export function LeavePageClient({ profile, requests: initialRequests }: LeavePageClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [requests, setRequests] = useState(initialRequests);
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const canManage = profile.role === "admin" || profile.role === "manager";

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;

      // Create leave_block shift via API
      await fetch("/api/leave/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveRequestId: id }),
      });

      setRequests((prev) =>
        prev.map((r) => r.id === id ? { ...r, status: "approved" as const } : r)
      );
      toast({ title: "Leave approved", description: "The rota has been updated." });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setProcessing(null);
    }
  }

  async function handleDeny(id: string) {
    setProcessing(id);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "denied",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      setRequests((prev) =>
        prev.map((r) => r.id === id ? { ...r, status: "denied" as const } : r)
      );
      toast({ title: "Leave denied" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setProcessing(null);
    }
  }

  function onRequestCreated(newRequest: LeaveRequestWithEmployee) {
    setRequests((prev) => [newRequest, ...prev]);
    setShowForm(false);
    toast({ title: "Leave request submitted", description: "Your manager will be notified." });
  }

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
          <p className="text-sm text-muted-foreground">Unpaid leave requests</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Request leave
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New leave request</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveRequestForm
              employeeId={profile.id}
              onSuccess={onRequestCreated}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Pending (managers see all; barbers see their own) */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pending ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((req) => (
              <Card key={req.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      {canManage && (
                        <p className="font-medium">{(req.employee as { full_name: string })?.full_name}</p>
                      )}
                      <p className="text-sm">
                        {format(parseISO(req.start_date), "d MMM yyyy")}
                        {req.start_date !== req.end_date &&
                          ` – ${format(parseISO(req.end_date), "d MMM yyyy")}`}
                      </p>
                      {req.reason && (
                        <p className="text-sm text-muted-foreground mt-0.5">{req.reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">Pending</Badge>
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleDeny(req.id)}
                            disabled={processing === req.id}
                          >
                            Deny
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(req.id)}
                            disabled={processing === req.id}
                          >
                            Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            History
          </h2>
          <div className="space-y-2">
            {history.map((req) => (
              <Card key={req.id} className="opacity-80">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {canManage && (
                        <p className="font-medium text-sm">{(req.employee as { full_name: string })?.full_name}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(req.start_date), "d MMM yyyy")}
                        {req.start_date !== req.end_date &&
                          ` – ${format(parseISO(req.end_date), "d MMM yyyy")}`}
                      </p>
                    </div>
                    <Badge variant={statusVariant[req.status] ?? "outline"}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {requests.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No leave requests yet.
        </div>
      )}
    </div>
  );
}
