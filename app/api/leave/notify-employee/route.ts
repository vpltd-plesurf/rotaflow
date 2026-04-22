import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { formatDateRange } from "@/lib/utils";
import { getResend, EMAIL_FROM, getAppUrl, getEmailForUser, emailWrapper, ctaButton } from "@/lib/email";

export async function POST(request: Request) {
  const { leaveRequestId, status } = await request.json();
  if (!leaveRequestId || !status) {
    return NextResponse.json({ error: "leaveRequestId and status required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: leave } = await supabase
    .from("leave_requests")
    .select("*, employee:profiles!leave_requests_employee_id_fkey(id, full_name)")
    .eq("id", leaveRequestId)
    .single();
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const employee = leave.employee as { id: string; full_name: string };
  const dateRange = formatDateRange(leave.start_date, leave.end_date);
  const statusLabel = status === "approved" ? "approved" : "denied";
  const statusColor = status === "approved" ? "#16a34a" : "#dc2626";

  const email = await getEmailForUser(supabase, employee.id);

  // Send email + in-app notification in parallel
  await Promise.all([
    email
      ? getResend().emails.send({
          from: EMAIL_FROM,
          to: email,
          subject: `Leave request ${statusLabel} — ${dateRange}`,
          html: emailWrapper(`
            <h2 style="color: ${statusColor};">Leave ${statusLabel}</h2>
            <p>Hi ${employee.full_name.split(" ")[0]},</p>
            <p>Your leave request for <strong>${dateRange}</strong> has been <strong>${statusLabel}</strong>.</p>
            ${leave.reason ? `<p>Reason given: ${leave.reason}</p>` : ""}
            <p>${ctaButton(`${getAppUrl()}/dashboard/leave`, "View leave")}</p>
          `),
        }).catch(() => {})
      : null,
    supabase.from("notifications").insert({
      recipient_id: employee.id,
      type: `leave_${statusLabel}`,
      message: `Your leave request for ${dateRange} has been ${statusLabel}.`,
      link: "/dashboard/leave",
      org_id: leave.org_id,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
