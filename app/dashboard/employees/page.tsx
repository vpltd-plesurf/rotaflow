import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmployeesPageClient } from "@/components/employees/employees-page-client";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role === "barber") redirect("/dashboard");

  // Fetch employees with details
  let empQuery = supabase
    .from("profiles")
    .select("*, location:locations(*), detail:employee_details(*)")
    .eq("role", "barber")
    .order("full_name");

  if (profile.role === "manager" && profile.location_id) {
    empQuery = empQuery.eq("location_id", profile.location_id) as typeof empQuery;
  }
  const { data: employees } = await empQuery;

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .order("name");

  // Fetch leave requests for all these employees
  const employeeIds = (employees ?? []).map((e: any) => e.id);
  const { data: leaveRequests } = employeeIds.length
    ? await supabase
        .from("leave_requests")
        .select("id, employee_id, start_date, end_date, status, reason, created_at")
        .in("employee_id", employeeIds)
        .order("start_date", { ascending: false })
    : { data: [] };

  // Fetch documents for all these employees
  const { data: documents } = employeeIds.length
    ? await supabase
        .from("documents")
        .select("id, employee_id, file_name, doc_type, file_path, file_size, created_at")
        .in("employee_id", employeeIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <EmployeesPageClient
      profile={profile as any}
      employees={(employees ?? []) as any}
      locations={locations ?? []}
      leaveRequests={leaveRequests ?? []}
      documents={documents ?? []}
    />
  );
}
