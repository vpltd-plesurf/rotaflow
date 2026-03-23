import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { format, parseISO } from "date-fns";

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = await request.json();
  const { type } = body; // "proposed" | "approved" | "denied"

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (type === "proposed") {
    // Notify managers that a barber wants to swap a shift
    const { shiftId, targetId } = body;

    const { data: shift } = await supabase
      .from("shifts")
      .select("*, employee:profiles!shifts_employee_id_fkey(full_name, location_id)")
      .eq("id", shiftId)
      .single();
    if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

    const employee = shift.employee as { full_name: string; location_id: string };
    const shiftDate = format(parseISO(shift.date), "EEE d MMM yyyy");
    const shiftTime = `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`;

    let targetName = "anyone available";
    if (targetId) {
      const { data: target } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", targetId)
        .single();
      if (target) targetName = target.full_name;
    }

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

    let sent = 0;
    for (const manager of managers) {
      const { data: authUser } = await supabase.auth.admin.getUserById(manager.id);
      const email = authUser?.user?.email;
      if (!email) continue;

      try {
        await resend.emails.send({
          from: "RotaFlow <no-reply@rotaflow.app>",
          to: email,
          subject: `Swap request from ${employee.full_name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #1d4ed8;">Shift swap request</h2>
              <p>Hi ${manager.full_name.split(" ")[0]},</p>
              <p><strong>${employee.full_name}</strong> wants to swap their shift on <strong>${shiftDate}</strong> (${shiftTime}) with <strong>${targetName}</strong>.</p>
              <p>
                <a href="${appUrl}/dashboard/swaps" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                  Review request
                </a>
              </p>
            </div>
          `,
        });
        sent++;
      } catch {
        // Don't fail the whole request
      }

      await supabase.from("notifications").insert({
        recipient_id: manager.id,
        type: "swap_request",
        message: `${employee.full_name} wants to swap their shift on ${shiftDate}.`,
        link: "/dashboard/swaps",
      });
    }

    return NextResponse.json({ ok: true, sent });
  }

  if (type === "approved" || type === "denied") {
    // Notify the requester that their swap was approved/denied
    const { swapId } = body;

    const { data: swap } = await supabase
      .from("shift_swaps")
      .select(`
        *,
        requester:profiles!shift_swaps_requester_id_fkey(id, full_name),
        shift:shifts!shift_swaps_shift_id_fkey(date, start_time, end_time)
      `)
      .eq("id", swapId)
      .single();
    if (!swap) return NextResponse.json({ error: "Swap not found" }, { status: 404 });

    const requester = swap.requester as { id: string; full_name: string };
    const shift = swap.shift as { date: string; start_time: string; end_time: string };
    const shiftDate = format(parseISO(shift.date), "EEE d MMM yyyy");
    const shiftTime = `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`;
    const statusLabel = type === "approved" ? "approved" : "denied";
    const statusColor = type === "approved" ? "#16a34a" : "#dc2626";

    // Email the requester
    const { data: authUser } = await supabase.auth.admin.getUserById(requester.id);
    const email = authUser?.user?.email;

    if (email) {
      try {
        await resend.emails.send({
          from: "RotaFlow <no-reply@rotaflow.app>",
          to: email,
          subject: `Swap request ${statusLabel} — ${shiftDate}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: ${statusColor};">Swap ${statusLabel}</h2>
              <p>Hi ${requester.full_name.split(" ")[0]},</p>
              <p>Your swap request for <strong>${shiftDate}</strong> (${shiftTime}) has been <strong>${statusLabel}</strong>.</p>
              <p>
                <a href="${appUrl}/dashboard/swaps" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                  View swaps
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
      recipient_id: requester.id,
      type: `swap_${statusLabel}`,
      message: `Your swap request for ${shiftDate} (${shiftTime}) has been ${statusLabel}.`,
      link: "/dashboard/swaps",
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
