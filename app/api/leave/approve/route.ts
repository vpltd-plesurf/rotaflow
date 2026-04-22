import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { addDays, format, parseISO } from "date-fns";
import { getWeekStart, toDbDate } from "@/lib/utils";

export async function POST(request: Request) {
  const { leaveRequestId } = await request.json();
  if (!leaveRequestId) return NextResponse.json({ error: "leaveRequestId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the leave request (org_id used to stamp rotas/shifts we create)
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", leaveRequestId)
    .single();
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const orgId: string = leave.org_id;

  // Fetch employee's location
  const { data: employee } = await supabase
    .from("profiles")
    .select("location_id")
    .eq("id", leave.employee_id)
    .single();
  if (!employee?.location_id) return NextResponse.json({ ok: true, blocks: 0 });

  // For each day in the leave range, create a leave_block shift
  const start = parseISO(leave.start_date);
  const end = parseISO(leave.end_date);
  let current = start;
  let created = 0;

  while (current <= end) {
    const dateStr = format(current, "yyyy-MM-dd");
    const weekStart = toDbDate(getWeekStart(current));

    // Get or create rota for this week
    let { data: rota } = await supabase
      .from("rotas")
      .select("id")
      .eq("location_id", employee.location_id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (!rota) {
      const { data: newRota } = await supabase
        .from("rotas")
        .insert({
          location_id: employee.location_id,
          week_start: weekStart,
          published: false,
          created_by: user.id,
          org_id: orgId,
        })
        .select("id")
        .single();
      rota = newRota;
    }

    if (rota) {
      // Check if there's already a leave block for this day
      const { count } = await supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("rota_id", rota.id)
        .eq("employee_id", leave.employee_id)
        .eq("date", dateStr)
        .eq("status", "leave_block");

      if (!count) {
        await supabase.from("shifts").insert({
          rota_id: rota.id,
          employee_id: leave.employee_id,
          date: dateStr,
          start_time: "00:00",
          end_time: "00:00",
          role_label: "Unpaid leave",
          notes: leave.reason ?? null,
          status: "leave_block",
          org_id: orgId,
        });
        created++;
      }
    }

    current = addDays(current, 1);
  }

  return NextResponse.json({ ok: true, blocks: created });
}
