"use client";

import { useState, useEffect } from "react";
import { LayoutTemplate, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { toDbDate } from "@/lib/utils";
import type { ShiftWithEmployee } from "@/lib/supabase/types";
import { getDay, parseISO } from "date-fns";

type Template = {
  id: string;
  name: string;
  created_at: string;
};

interface TemplateMenuProps {
  locationId: string;
  orgId: string;
  shifts: ShiftWithEmployee[];
  weekStart: string;
  ensureRota: () => Promise<string>;
  onApplied: () => void;
}

/** Convert a date string to day_index (0=Mon … 6=Sun) */
function dateToDayIndex(dateStr: string): number {
  const dow = getDay(parseISO(dateStr)); // 0=Sun, 1=Mon ... 6=Sat
  return dow === 0 ? 6 : dow - 1;
}

export function TemplateMenu({
  locationId,
  orgId,
  shifts,
  weekStart,
  ensureRota,
  onApplied,
}: TemplateMenuProps) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function fetchTemplates() {
    const { data } = await supabase
      .from("rota_templates")
      .select("id, name, created_at")
      .eq("location_id", locationId)
      .order("name");
    if (data) setTemplates(data);
  }

  useEffect(() => {
    fetchTemplates();
  }, [locationId]);

  async function handleSave() {
    if (!templateName.trim()) {
      toast({ variant: "destructive", title: "Enter a template name" });
      return;
    }

    const scheduledShifts = shifts.filter((s) => s.status === "scheduled");
    if (scheduledShifts.length === 0) {
      toast({ variant: "destructive", title: "No shifts to save", description: "Add scheduled shifts first." });
      return;
    }

    setSaving(true);
    try {
      // Create template
      const { data: template, error: tErr } = await supabase
        .from("rota_templates")
        .insert({
          name: templateName.trim(),
          location_id: locationId,
          created_by: (await supabase.auth.getUser()).data.user!.id,
          org_id: orgId,
        })
        .select("id")
        .single();
      if (tErr) throw tErr;

      // Create template shifts
      const templateShifts = scheduledShifts.map((s) => ({
        template_id: template.id,
        employee_id: s.employee_id,
        day_index: dateToDayIndex(s.date),
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5),
        role_label: s.role_label || null,
        org_id: orgId,
      }));

      const { error: sErr } = await supabase
        .from("rota_template_shifts")
        .insert(templateShifts);
      if (sErr) throw sErr;

      toast({
        title: "Template saved",
        description: `"${templateName.trim()}" — ${templateShifts.length} shifts`,
      });
      setSaveOpen(false);
      setTemplateName("");
      fetchTemplates();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleApply() {
    if (!selectedTemplateId) return;

    setApplying(true);
    try {
      // Get template shifts
      const { data: templateShifts, error } = await supabase
        .from("rota_template_shifts")
        .select("*")
        .eq("template_id", selectedTemplateId);
      if (error) throw error;
      if (!templateShifts?.length) {
        toast({ variant: "destructive", title: "Template is empty" });
        return;
      }

      const rotaId = await ensureRota();

      // Convert day_index to actual dates for the target week
      const weekDate = new Date(weekStart + "T00:00:00");
      const newShifts = templateShifts.map((ts) => {
        const targetDate = new Date(weekDate);
        targetDate.setDate(targetDate.getDate() + ts.day_index);
        return {
          rota_id: rotaId,
          employee_id: ts.employee_id,
          date: toDbDate(targetDate),
          start_time: ts.start_time,
          end_time: ts.end_time,
          role_label: ts.role_label || null,
          status: "scheduled" as const,
          org_id: orgId,
        };
      });

      const { error: insertErr } = await supabase.from("shifts").insert(newShifts);
      if (insertErr) throw insertErr;

      const tmpl = templates.find((t) => t.id === selectedTemplateId);
      toast({
        title: "Template applied",
        description: `"${tmpl?.name}" — ${newShifts.length} shifts added`,
      });
      setApplyOpen(false);
      setSelectedTemplateId(null);
      onApplied();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setApplying(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("rota_templates").delete().eq("id", id);
      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirmId(null);
      toast({ title: "Template deleted" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setSaveOpen(true)}>
            <Save className="h-4 w-4 mr-2" />
            Save current week as template
          </DropdownMenuItem>
          {templates.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {templates.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  className="flex justify-between"
                  onClick={() => {
                    setSelectedTemplateId(t.id);
                    setApplyOpen(true);
                  }}
                >
                  <span className="truncate">{t.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(t.id);
                    }}
                    className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          )}
          {templates.length === 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No saved templates yet
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save template dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Template name</Label>
              <Input
                placeholder="e.g. Standard week, Holiday cover"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Saves {shifts.filter((s) => s.status === "scheduled").length} scheduled shifts as a reusable template for this location.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply template dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will add the template&apos;s shifts to the current week. Existing shifts won&apos;t be removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? "Applying..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete &quot;{templates.find((t) => t.id === deleteConfirmId)?.name}&quot;.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
