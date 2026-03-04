import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentsPageClient } from "@/components/documents/documents-page-client";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  // Barbers see only their own documents
  let query = supabase
    .from("documents")
    .select("*, employee:profiles!documents_employee_id_fkey(id, full_name)")
    .order("created_at", { ascending: false });

  if (profile.role === "barber") {
    query = query.eq("employee_id", user.id) as typeof query;
  }

  const { data: documents } = await query;

  // Employees list for upload target (managers/admins)
  let employees: { id: string; full_name: string }[] = [];
  if (profile.role !== "barber") {
    let empQuery = supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "barber")
      .order("full_name");
    if (profile.role === "manager" && profile.location_id) {
      empQuery = empQuery.eq("location_id", profile.location_id) as typeof empQuery;
    }
    const { data } = await empQuery;
    employees = data ?? [];
  }

  return (
    <DocumentsPageClient
      profile={profile}
      documents={(documents ?? []) as never}
      employees={employees}
    />
  );
}
