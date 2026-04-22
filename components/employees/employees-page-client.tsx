"use client";

import { useState } from "react";
import { Plus, Pencil, UserX, UserCheck, CalendarOff, FileText, ChevronRight } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmployeeDialog } from "@/components/employees/employee-dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ProfileWithLocation, Location, DocType } from "@/lib/supabase/types";

type EmployeeWithDetail = ProfileWithLocation & {
  detail: {
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    notes: string | null;
    status: "active" | "inactive";
  } | null;
};

type LeaveRecord = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "denied";
  reason: string | null;
  created_at: string;
};

type DocRecord = {
  id: string;
  employee_id: string;
  file_name: string;
  doc_type: DocType;
  file_path: string;
  file_size: number | null;
  created_at: string;
};

interface EmployeesPageClientProps {
  profile: ProfileWithLocation;
  employees: EmployeeWithDetail[];
  locations: Location[];
  leaveRequests: LeaveRecord[];
  documents: DocRecord[];
}

const docTypeLabels: Record<DocType, string> = {
  contract: "Contract",
  insurance: "Insurance",
  id: "ID Document",
  other: "Other",
};

const statusVariant: Record<string, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  denied: "destructive",
};

function leaveDays(req: LeaveRecord): number {
  return differenceInDays(parseISO(req.end_date), parseISO(req.start_date)) + 1;
}

export function EmployeesPageClient({
  profile,
  employees: initialEmployees,
  locations,
  leaveRequests,
  documents,
}: EmployeesPageClientProps) {
  const supabase = createClient();
  const [employees, setEmployees] = useState(initialEmployees);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeWithDetail | null>(null);
  const [selected, setSelected] = useState<EmployeeWithDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "leave" | "docs">("info");

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(emp: EmployeeWithDetail) { setEditing(emp); setDialogOpen(true); }
  function openDrawer(emp: EmployeeWithDetail) { setSelected(emp); setActiveTab("info"); }

  async function toggleStatus(emp: EmployeeWithDetail) {
    const newStatus = emp.detail?.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("employee_details").update({ status: newStatus }).eq("id", emp.id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, detail: { ...e.detail!, status: newStatus } } : e));
    if (selected?.id === emp.id) setSelected((s) => s ? { ...s, detail: { ...s.detail!, status: newStatus } } : s);
  }

  function onSaved(updated: EmployeeWithDetail) {
    if (editing) {
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      if (selected?.id === updated.id) setSelected(updated);
    } else {
      setEmployees((prev) => [...prev, updated]);
    }
    setDialogOpen(false);
  }

  async function handleDownload(doc: DocRecord) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60);
    if (error || !data) { toast({ variant: "destructive", title: "Download failed" }); return; }
    window.open(data.signedUrl, "_blank");
  }

  const active = employees.filter((e) => e.detail?.status !== "inactive");
  const inactive = employees.filter((e) => e.detail?.status === "inactive");

  // Per-employee summaries
  function getLeaveForEmployee(id: string) {
    return leaveRequests.filter((r) => r.employee_id === id);
  }
  function getDocsForEmployee(id: string) {
    return documents.filter((d) => d.employee_id === id);
  }
  function approvedDays(id: string) {
    return getLeaveForEmployee(id)
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + leaveDays(r), 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">{active.length} active barbers</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Add barber
        </Button>
      </div>

      <EmployeeGrid
        employees={active}
        locations={locations}
        onEdit={openEdit}
        onToggleStatus={toggleStatus}
        onSelect={openDrawer}
        approvedDays={approvedDays}
        docCount={(id) => getDocsForEmployee(id).length}
      />

      {inactive.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Inactive ({inactive.length})
          </h2>
          <EmployeeGrid
            employees={inactive}
            locations={locations}
            onEdit={openEdit}
            onToggleStatus={toggleStatus}
            onSelect={openDrawer}
            approvedDays={approvedDays}
            docCount={(id) => getDocsForEmployee(id).length}
            dimmed
          />
        </section>
      )}

      {/* Edit dialog */}
      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        locations={locations}
        currentUserRole={profile.role}
        orgId={profile.org_id}
        onSaved={onSaved}
      />

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent>
          {selected && (
            <div className="flex flex-col h-full overflow-hidden">
              <SheetHeader className="mb-4">
                <SheetTitle>{selected.full_name}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {locations.find((l) => l.id === selected.location_id)?.name ?? "No location"}
                </p>
              </SheetHeader>

              {/* Tabs */}
              <div className="flex gap-1 border-b mb-4">
                {(["info", "leave", "docs"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "info" ? "Info" : tab === "leave" ? "Leave" : "Documents"}
                    {tab === "leave" && getLeaveForEmployee(selected.id).filter(r => r.status === "pending").length > 0 && (
                      <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                        {getLeaveForEmployee(selected.id).filter(r => r.status === "pending").length}
                      </span>
                    )}
                    {tab === "docs" && getDocsForEmployee(selected.id).length > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({getDocsForEmployee(selected.id).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto space-y-3">

                {/* INFO TAB */}
                {activeTab === "info" && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(selected); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </div>
                    <InfoRow label="Phone" value={selected.phone} />
                    <InfoRow label="Rate" value={selected.hourly_rate != null ? `£${selected.hourly_rate.toFixed(2)}/hr` : null} />
                    <InfoRow label="Status" value={
                      <Badge variant={selected.detail?.status === "active" ? "success" : "outline"}>
                        {selected.detail?.status ?? "active"}
                      </Badge>
                    } />
                    {selected.detail?.emergency_contact_name && (
                      <>
                        <hr />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency contact</p>
                        <InfoRow label="Name" value={selected.detail.emergency_contact_name} />
                        <InfoRow label="Phone" value={selected.detail.emergency_contact_phone} />
                      </>
                    )}
                    {selected.detail?.notes && (
                      <>
                        <hr />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
                        <p className="text-sm">{selected.detail.notes}</p>
                      </>
                    )}
                    <hr />
                    <Button
                      variant="ghost"
                      size="sm"
                      className={selected.detail?.status === "active" ? "text-destructive" : "text-green-600"}
                      onClick={() => toggleStatus(selected)}
                    >
                      {selected.detail?.status === "active" ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      {selected.detail?.status === "active" ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                )}

                {/* LEAVE TAB */}
                {activeTab === "leave" && (() => {
                  const empLeave = getLeaveForEmployee(selected.id);
                  const approved = empLeave.filter(r => r.status === "approved");
                  const totalDays = approved.reduce((sum, r) => sum + leaveDays(r), 0);
                  return (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total approved leave</span>
                        <span className="font-semibold">{totalDays} day{totalDays !== 1 ? "s" : ""}</span>
                      </div>
                      {empLeave.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No leave records.</p>
                      ) : (
                        empLeave.map((req) => (
                          <div key={req.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                            <div>
                              <p className="text-sm">
                                {format(parseISO(req.start_date), "d MMM yyyy")}
                                {req.start_date !== req.end_date && ` – ${format(parseISO(req.end_date), "d MMM yyyy")}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {leaveDays(req)} day{leaveDays(req) !== 1 ? "s" : ""}
                                {req.reason ? ` · ${req.reason}` : ""}
                              </p>
                            </div>
                            <Badge variant={statusVariant[req.status] ?? "outline"}>
                              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}

                {/* DOCS TAB */}
                {activeTab === "docs" && (() => {
                  const empDocs = getDocsForEmployee(selected.id);
                  return (
                    <div className="space-y-2">
                      {empDocs.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          No documents uploaded yet.
                          <br />
                          <span className="text-xs">Go to the Documents page to upload files.</span>
                        </div>
                      ) : (
                        empDocs.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => handleDownload(doc)}
                            className="w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                          >
                            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {docTypeLabels[doc.doc_type]} · {format(new Date(doc.created_at), "d MMM yyyy")}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </button>
                        ))
                      )}
                    </div>
                  );
                })()}

              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function EmployeeGrid({
  employees,
  locations,
  onEdit,
  onToggleStatus,
  onSelect,
  approvedDays,
  docCount,
  dimmed = false,
}: {
  employees: EmployeeWithDetail[];
  locations: Location[];
  onEdit: (e: EmployeeWithDetail) => void;
  onToggleStatus: (e: EmployeeWithDetail) => void;
  onSelect: (e: EmployeeWithDetail) => void;
  approvedDays: (id: string) => number;
  docCount: (id: string) => number;
  dimmed?: boolean;
}) {
  if (employees.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        No barbers yet. Add one to get started.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {employees.map((emp) => {
        const location = locations.find((l) => l.id === emp.location_id);
        const isActive = emp.detail?.status !== "inactive";
        const days = approvedDays(emp.id);
        const docs = docCount(emp.id);
        return (
          <Card
            key={emp.id}
            className={`cursor-pointer hover:border-primary/50 transition-colors ${dimmed ? "opacity-60" : ""}`}
            onClick={() => onSelect(emp)}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{emp.full_name}</p>
                  {location && (
                    <p className="text-xs text-muted-foreground truncate">{location.name}</p>
                  )}
                  {emp.phone && (
                    <p className="text-xs text-muted-foreground">{emp.phone}</p>
                  )}
                  {/* Leave + docs summary */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarOff className="h-3 w-3" />
                      {days} day{days !== 1 ? "s" : ""} leave
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      {docs} doc{docs !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(emp)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleStatus(emp)}
                    title={isActive ? "Deactivate" : "Reactivate"}
                  >
                    {isActive ? (
                      <UserX className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
