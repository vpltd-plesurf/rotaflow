import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { format, parseISO } from "date-fns";

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { leaveRequestId, status } = await request.json();
  if (!leaveRequestId || !status) {
    return NextResponse.json({ error: "leaveRequestId and status required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the leave request with employee details
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("*, employee:profiles!leave_requests_employee_id_fkey(id, full_name)")
    .eq("id", leaveRequestId)
    .single();
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const employee = leave.employee as { id: string; full_name: string };
  const startFormatted = format(parseISO(leave.start_date), "d MMM yyyy");
  const endFormatted = leave.start_date !== leave.end_date
    ? ` – ${format(parseISO(leave.end_date), "d MMM yyyy")}`
    : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const statusLabel = status === "approved" ? "approved" : "denied";
  const statusColor = status === "approved" ? "#16a34a" : "#dc2626";

  // Get employee's email
  const { data: authUser } = await supabase.auth.admin.getUserById(employee.id);
  const email = authUser?.user?.email;

  if (email) {
    try {
      await resend.emails.send({
        from: "RotaFlow <no-reply@rotaflow.app>",
        to: email,
        subject: `Leave request ${statusLabel} — ${startFormatted}${endFormatted}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: ${statusColor};">Leave ${statusLabel}</h2>
            <p>Hi ${employee.full_name.split(" ")[0]},</p>
            <p>Your leave request for <strong>${startFormatted}${endFormatted}</strong> has been <strong>${statusLabel}</strong>.</p>
            ${leave.reason ? `<p>Reason given: ${leave.reason}</p>` : ""}
            <p>
              <a href="${appUrl}/dashboard/leave" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                View leave
              </a>
            </p>
          </div>
        `,
      });
    } catch {
      // Don't fail
    }
  }

  // In-app notification
  await supabase.from("notifications").insert({
    recipient_id: employee.id,
    type: `leave_${statusLabel}`,
    message: `Your leave request for ${startFormatted}${endFormatted} has been ${statusLabel}.`,
    link: "/dashboard/leave",
  });

  return NextResponse.json({ ok: true });
}
