import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RotaView } from "@/components/rota/rota-view";
import { getWeekStart, toDbDate } from "@/lib/utils";

export default async function RotaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; location?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  // Determine which week to show
  const weekStart = params.week
    ? new Date(params.week)
    : getWeekStart(new Date());
  const weekStartStr = toDbDate(weekStart);

  // Admin can switch location; others see their own
  const locationId = profile.role === "admin"
    ? (params.location ?? null)
    : profile.location_id;

  // Fetch all locations (for admin switcher + shop hours)
  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .order("name");

  const currentLocation = locations?.find((l) => l.id === locationId);

  // Fetch employees for this location
  let employeesQuery = supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("role", "barber")
    .order("full_name");

  if (locationId) {
    employeesQuery = employeesQuery.eq("location_id", locationId) as typeof employeesQuery;
  }
  const { data: employees } = await employeesQuery;

  // Fetch or create rota for this week + location
  let rota = null;
  if (locationId) {
    const { data: existing } = await supabase
      .from("rotas")
      .select("*")
      .eq("location_id", locationId)
      .eq("week_start", weekStartStr)
      .maybeSingle();
    rota = existing;
  }

  // Fetch shifts for this rota
  const shifts = rota
    ? (await supabase
        .from("shifts")
        .select("*, employee:profiles(*)")
        .eq("rota_id", rota.id)
        .order("start_time")).data ?? []
    : [];

  return (
    <RotaView
      profile={profile}
      locations={locations ?? []}
      employees={employees ?? []}
      rota={rota}
      shifts={shifts as never}
      weekStart={weekStartStr}
      locationId={locationId}
      weeklyHours={currentLocation?.weekly_hours}
    />
  );
}
