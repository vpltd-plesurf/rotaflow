import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SwapsPageClient } from "@/components/swaps/swaps-page-client";

export default async function SwapsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const { data: swaps } = await supabase
    .from("shift_swaps")
    .select(`
      *,
      requester:profiles!shift_swaps_requester_id_fkey(id, full_name),
      target:profiles!shift_swaps_target_id_fkey(id, full_name),
      shift:shifts!shift_swaps_shift_id_fkey(id, date, start_time, end_time),
      target_shift:shifts!shift_swaps_target_shift_id_fkey(id, date, start_time, end_time)
    `)
    .order("created_at", { ascending: false });

  // Barbers only see their own swaps
  const filtered =
    profile.role === "barber"
      ? (swaps ?? []).filter(
          (s) =>
            (s.requester as { id: string }).id === user.id ||
            (s.target as { id: string } | null)?.id === user.id
        )
      : (swaps ?? []);

  // Barber's upcoming shifts for proposing swaps
  let myShifts: { id: string; date: string; start_time: string; end_time: string }[] = [];
  if (profile.role === "barber") {
    const { data } = await supabase
      .from("shifts")
      .select("id, date, start_time, end_time")
      .eq("employee_id", user.id)
      .eq("status", "scheduled")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date")
      .limit(20);
    myShifts = data ?? [];
  }

  return (
    <SwapsPageClient
      profile={profile}
      swaps={filtered as never}
      myShifts={myShifts}
    />
  );
}
