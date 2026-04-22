import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LocationsPageClient } from "@/components/locations/locations-page-client";

export default async function LocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .order("name");

  // Employee count per location
  const { data: counts } = await supabase
    .from("profiles")
    .select("location_id")
    .eq("role", "barber");

  const countMap = (counts ?? []).reduce<Record<string, number>>((acc, p) => {
    if (p.location_id) acc[p.location_id] = (acc[p.location_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <LocationsPageClient
      locations={(locations ?? []).map((l) => ({ ...l, barberCount: countMap[l.id] ?? 0 }))}
      orgId={profile.org_id}
    />
  );
}
