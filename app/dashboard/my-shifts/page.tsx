import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MyShiftsClient } from "@/components/rota/my-shifts-client";

export default async function MyShiftsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  // Barbers only — redirect others to the full rota
  if (profile.role !== "barber") redirect("/dashboard/rota");

  // Fetch upcoming shifts (next 4 weeks)
  const today = new Date().toISOString().slice(0, 10);
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, employee:profiles(*), rota:rotas(location_id, location:locations(name))")
    .eq("employee_id", user.id)
    .gte("date", today)
    .order("date")
    .order("start_time")
    .limit(50);

  // Also fetch recent past shifts (last 7 days) for context
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const { data: pastShifts } = await supabase
    .from("shifts")
    .select("*, employee:profiles(*), rota:rotas(location_id, location:locations(name))")
    .eq("employee_id", user.id)
    .gte("date", weekAgoStr)
    .lt("date", today)
    .order("date", { ascending: false })
    .order("start_time")
    .limit(14);

  return (
    <MyShiftsClient
      profile={profile}
      upcomingShifts={(shifts ?? []) as never}
      pastShifts={(pastShifts ?? []) as never}
    />
  );
}
