import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LeavePageClient } from "@/components/leave/leave-page-client";

export default async function LeavePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  // Fetch leave requests
  let query = supabase
    .from("leave_requests")
    .select(`
      *,
      employee:profiles!leave_requests_employee_id_fkey(id, full_name, location_id),
      reviewer:profiles!leave_requests_reviewed_by_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (profile.role === "barber") {
    query = query.eq("employee_id", user.id) as typeof query;
  } else if (profile.role === "manager" && profile.location_id) {
    // Filter by employees at this location — done client-side from the join
  }

  const { data: requests } = await query;

  // Filter manager's requests to their location
  const filtered =
    profile.role === "manager" && profile.location_id
      ? (requests ?? []).filter(
          (r) => (r.employee as { location_id: string })?.location_id === profile.location_id
        )
      : (requests ?? []);

  return (
    <LeavePageClient
      profile={profile}
      requests={filtered as never}
    />
  );
}
