import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { format, parseISO } from "date-fns";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { leaveRequestId } = await request.json();
  if (!leaveRequestId) return NextResponse.json({ error: "leaveRequestId required" }, { status: 400 });

  const supabase = await createClient();

  const { data: leave } = await supabase
    .from("leave_requests")
    .select("*, employee:profiles!leave_requests_employee_id_fkey(full_name, location_id)")
    .eq("id", leaveRequestId)
    .single();
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const employee = leave.employee as { full_name: string; location_id: string };

  // Get managers for this location + admins
  const { data: managers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["admin", "manager"])
    .or(
      employee.location_id
        ? `location_id.eq.${employee.location_id},role.eq.admin`
        : "role.eq.admin"
    );

  if (!managers?.length) return NextResponse.json({ ok: true, sent: 0 });

  const startFormatted = format(parseISO(leave.start_date), "d MMM yyyy");
  const endFormatted = leave.start_date !== leave.end_date
    ? ` – ${format(parseISO(leave.end_date), "d MMM yyyy")}`
    : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let sent = 0;
  for (const manager of managers) {
    const { data: authUser } = await supabase.auth.admin.getUserById(manager.id);
    const email = authUser?.user?.email;
    if (!email) continue;

    try {
      await resend.emails.send({
        from: "RotaFlow <no-reply@rotaflow.app>",
        to: email,
        subject: `Leave request from ${employee.full_name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1d4ed8;">New leave request</h2>
            <p>Hi ${manager.full_name.split(" ")[0]},</p>
            <p><strong>${employee.full_name}</strong> has requested unpaid leave for <strong>${startFormatted}${endFormatted}</strong>.</p>
            ${leave.reason ? `<p>Reason: ${leave.reason}</p>` : ""}
            <p>
              <a href="${appUrl}/dashboard/leave" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                Review request
              </a>
            </p>
          </div>
        `,
      });
      sent++;

      // Also create an in-app notification
      await supabase.from("notifications").insert({
        recipient_id: manager.id,
        type: "leave_request",
        message: `${employee.full_name} has requested leave for ${startFormatted}${endFormatted}.`,
        link: "/dashboard/leave",
      });
    } catch {
      // Don't fail the whole request
    }
  }

  return NextResponse.json({ ok: true, sent });
}
