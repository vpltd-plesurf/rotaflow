"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

type ShiftOption = { id: string; date: string; start_time: string; end_time: string };
type Colleague = { id: string; full_name: string };

interface SwapProposalFormProps {
  requesterId: string;
  orgId: string;
  myShifts: ShiftOption[];
  colleagues: Colleague[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function SwapProposalForm({
  requesterId,
  orgId,
  myShifts,
  colleagues,
  onSuccess,
  onCancel,
}: SwapProposalFormProps) {
  const supabase = createClient();
  const [shiftId, setShiftId] = useState("");
  const [targetId, setTargetId] = useState("anyone");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shiftId) {
      toast({ variant: "destructive", title: "Please select a shift" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("shift_swaps").insert({
        requester_id: requesterId,
        shift_id: shiftId,
        target_id: targetId === "anyone" ? null : targetId,
        message: message.trim() || null,
        status: "pending",
        org_id: orgId,
      });
      if (error) throw error;

      // Notify managers
      try {
        await fetch("/api/swaps/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "proposed", shiftId, targetId: targetId === "anyone" ? null : targetId }),
        });
      } catch {
        // Non-critical
      }

      toast({ title: "Swap request submitted", description: "Your manager will review it." });
      onSuccess();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="shift">Your shift to swap</Label>
        <Select value={shiftId} onValueChange={setShiftId}>
          <SelectTrigger id="shift">
            <SelectValue placeholder="Select a shift..." />
          </SelectTrigger>
          <SelectContent>
            {myShifts.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {format(parseISO(s.date), "EEE d MMM")} &middot; {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {myShifts.length === 0 && (
          <p className="text-xs text-muted-foreground">No upcoming shifts to swap.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="target">Swap with</Label>
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger id="target">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anyone">Anyone available</SelectItem>
            {colleagues.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message (optional)</Label>
        <Textarea
          id="message"
          placeholder="Any details about the swap..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || myShifts.length === 0}>
          {submitting ? "Submitting..." : "Submit request"}
        </Button>
      </div>
    </form>
  );
}
