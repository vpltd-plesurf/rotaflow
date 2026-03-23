"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SwapProposalForm } from "@/components/swaps/swap-proposal-form";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ProfileWithLocation } from "@/lib/supabase/types";

type SwapWithDetails = {
  id: string;
  requester_id: string;
  target_id: string | null;
  shift_id: string;
  target_shift_id: string | null;
  message: string | null;
  status: "pending" | "approved" | "denied";
  reviewed_by: string | null;
  created_at: string;
  requester: { id: string; full_name: string } | null;
  target: { id: string; full_name: string } | null;
  shift: { id: string; date: string; start_time: string; end_time: string } | null;
  target_shift: { id: string; date: string; start_time: string; end_time: string } | null;
};

interface SwapsPageClientProps {
  profile: ProfileWithLocation;
  swaps: SwapWithDetails[];
  myShifts: { id: string; date: string; start_time: string; end_time: string }[];
  colleagues: { id: string; full_name: string }[];
}

const statusVariant: Record<string, "warning" | "success" | "destructive" | "outline"> = {
  pending: "warning",
  approved: "success",
  denied: "destructive",
};

function formatShift(shift: { date: string; start_time: string; end_time: string } | null) {
  if (!shift) return "—";
  return `${format(parseISO(shift.date), "EEE d MMM")} · ${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`;
}

export function SwapsPageClient({ profile, swaps: initialSwaps, myShifts, colleagues }: SwapsPageClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [swaps, setSwaps] = useState(initialSwaps);
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const canManage = profile.role === "admin" || profile.role === "manager";
  const isBarber = profile.role === "barber";
  const pending = swaps.filter((s) => s.status === "pending");
  const history = swaps.filter((s) => s.status !== "pending");

  async function handleApprove(swap: SwapWithDetails) {
    setProcessing(swap.id);
    try {
      // Update swap status
      const { error } = await supabase
        .from("shift_swaps")
        .update({
          status: "approved",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", swap.id);
      if (error) throw error;

      // Swap the employee_ids on the shifts
      if (swap.shift_id && swap.target_shift_id && swap.target_id) {
        await supabase
          .from("shifts")
          .update({ employee_id: swap.target_id, status: "scheduled" })
          .eq("id", swap.shift_id);
        await supabase
          .from("shifts")
          .update({ employee_id: swap.requester_id, status: "scheduled" })
          .eq("id", swap.target_shift_id);
      } else if (swap.shift_id && swap.target_id) {
        // Simple handover (no target shift)
        await supabase
          .from("shifts")
          .update({ employee_id: swap.target_id, status: "scheduled" })
          .eq("id", swap.shift_id);
      }

      // Notify requester
      try {
        await fetch("/api/swaps/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "approved", swapId: swap.id }),
        });
      } catch {
        // Non-critical
      }

      setSwaps((prev) =>
        prev.map((s) => s.id === swap.id ? { ...s, status: "approved" as const } : s)
      );
      toast({ title: "Swap approved", description: "The rota has been updated." });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setProcessing(null);
    }
  }

  async function handleDeny(id: string) {
    setProcessing(id);
    try {
      await supabase
        .from("shift_swaps")
        .update({
          status: "denied",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      // Notify requester
      try {
        await fetch("/api/swaps/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "denied", swapId: id }),
        });
      } catch {
        // Non-critical
      }

      setSwaps((prev) =>
        prev.map((s) => s.id === id ? { ...s, status: "denied" as const } : s)
      );
      toast({ title: "Swap denied" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shift Swaps</h1>
          <p className="text-sm text-muted-foreground">
            {canManage ? "Review and approve swap requests" : "Request and view shift swaps"}
          </p>
        </div>
        {isBarber && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Request swap
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New swap request</CardTitle>
          </CardHeader>
          <CardContent>
            <SwapProposalForm
              requesterId={profile.id}
              myShifts={myShifts}
              colleagues={colleagues}
              onSuccess={() => {
                setShowForm(false);
                router.refresh();
              }}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pending ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((swap) => (
              <Card key={swap.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{swap.requester?.full_name}</span>
                        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{swap.target?.full_name ?? "Anyone"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatShift(swap.shift)}
                        {swap.target_shift && ` ↔ ${formatShift(swap.target_shift)}`}
                      </p>
                      {swap.message && (
                        <p className="text-xs text-muted-foreground italic">{swap.message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">Pending</Badge>
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive"
                            onClick={() => handleDeny(swap.id)}
                            disabled={processing === swap.id}
                          >
                            Deny
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(swap)}
                            disabled={processing === swap.id}
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

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            History
          </h2>
          <div className="space-y-2">
            {history.map((swap) => (
              <Card key={swap.id} className="opacity-75">
                <CardContent className="pt-3 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span>{swap.requester?.full_name}</span>
                        <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                        <span>{swap.target?.full_name ?? "Anyone"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatShift(swap.shift)}</p>
                    </div>
                    <Badge variant={statusVariant[swap.status] ?? "outline"}>
                      {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {swaps.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No swap requests yet.
        </div>
      )}
    </div>
  );
}
