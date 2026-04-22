"use client";

import { useState } from "react";
import { Plus, Pencil, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { WeeklyHours, DayKey } from "@/lib/supabase/types";
import { DAY_KEYS, DAY_LABELS } from "@/lib/supabase/types";

type LocationWithCount = {
  id: string;
  name: string;
  address: string | null;
  weekly_hours: WeeklyHours;
  created_at: string;
  barberCount: number;
};

const DEFAULT_HOURS: WeeklyHours = {
  mon: { open: "09:00", close: "18:00", closed: false, lunch_mins: 60 },
  tue: { open: "09:00", close: "18:00", closed: false, lunch_mins: 60 },
  wed: { open: "09:00", close: "18:00", closed: false, lunch_mins: 60 },
  thu: { open: "09:00", close: "18:00", closed: false, lunch_mins: 60 },
  fri: { open: "09:00", close: "19:00", closed: false, lunch_mins: 60 },
  sat: { open: "09:00", close: "16:00", closed: false, lunch_mins: 40 },
  sun: { open: "10:00", close: "16:00", closed: true,  lunch_mins: 30 },
};

function openDays(wh: WeeklyHours): string {
  const open = DAY_KEYS.filter((d) => !wh[d].closed);
  if (open.length === 0) return "Closed all week";
  if (open.length === 7) return "Open every day";
  return open.map((d) => DAY_LABELS[d]).join(", ");
}

export function LocationsPageClient({
  locations: initialLocations,
  orgId,
}: {
  locations: LocationWithCount[];
  orgId: string;
}) {
  const supabase = createClient();
  const [locations, setLocations] = useState(initialLocations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LocationWithCount | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState<WeeklyHours>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setName(""); setAddress("");
    setHours(DEFAULT_HOURS);
    setDialogOpen(true);
  }

  function openEdit(loc: LocationWithCount) {
    setEditing(loc);
    setName(loc.name);
    setAddress(loc.address ?? "");
    // Merge with defaults so any missing fields (e.g. lunch_mins added later) are filled
    const merged = { ...DEFAULT_HOURS };
    for (const d of DAY_KEYS) {
      merged[d] = { ...DEFAULT_HOURS[d], ...(loc.weekly_hours?.[d] ?? {}) };
    }
    setHours(merged);
    setDialogOpen(true);
  }

  function setDay<K extends keyof WeeklyHours[DayKey]>(day: DayKey, field: K, value: WeeklyHours[DayKey][K]) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast({ variant: "destructive", title: "Name is required" }); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), address: address.trim() || null, weekly_hours: hours };
      if (editing) {
        const { error } = await supabase.from("locations").update(payload).eq("id", editing.id);
        if (error) throw error;
        setLocations((prev) => prev.map((l) => l.id === editing.id ? { ...l, ...payload } : l));
        toast({ title: "Location updated" });
      } else {
        const { data, error } = await supabase
          .from("locations")
          .insert({ ...payload, org_id: orgId })
          .select()
          .single();
        if (error) throw error;
        setLocations((prev) => [...prev, { ...data, barberCount: 0 }]);
        toast({ title: "Location added" });
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">{locations.length} locations</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Add location
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((loc) => {
          const wh = loc.weekly_hours ?? DEFAULT_HOURS;
          const firstOpen = DAY_KEYS.find((d) => !wh[d].closed);
          return (
            <Card key={loc.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{loc.name}</p>
                      {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {firstOpen ? `${wh[firstOpen].open}–${wh[firstOpen].close}` : "Closed"}
                      </div>
                      <p className="text-xs text-muted-foreground">{openDays(wh)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {loc.barberCount} barber{loc.barberCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(loc)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit location" : "Add location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="High Street" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Address <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea placeholder="1 High Street, London EC1A 1BB" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            {/* Weekly hours */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opening hours</p>
              <div className="rounded-lg border divide-y">
                {DAY_KEYS.map((day) => {
                  const d = hours[day];
                  return (
                    <div key={day} className="flex items-center gap-2 px-3 py-2">
                      <span className="w-8 shrink-0 text-sm font-medium">{DAY_LABELS[day]}</span>
                      {d.closed ? (
                        <span className="flex-1 text-sm text-muted-foreground">Closed</span>
                      ) : (
                        <div className="flex flex-1 flex-wrap items-center gap-1.5">
                          <Input
                            type="time"
                            value={d.open}
                            onChange={(e) => setDay(day, "open", e.target.value)}
                            className="h-7 w-[5.5rem] px-2 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input
                            type="time"
                            value={d.close}
                            onChange={(e) => setDay(day, "close", e.target.value)}
                            className="h-7 w-[5.5rem] px-2 text-sm"
                          />
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={180}
                              step={5}
                              value={d.lunch_mins}
                              onChange={(e) => setDay(day, "lunch_mins", Number(e.target.value))}
                              className="h-7 w-14 px-2 text-sm text-center"
                              title="Lunch break (minutes)"
                            />
                            <span className="text-xs text-muted-foreground shrink-0">min</span>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setDay(day, "closed", !d.closed)}
                        className={`ml-auto shrink-0 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                          d.closed
                            ? "bg-muted text-muted-foreground hover:bg-muted/70"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {d.closed ? "Closed" : "Open"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
