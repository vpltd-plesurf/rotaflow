import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { getResend, EMAIL_FROM, getAppUrl, getEmailForUser, emailWrapper, ctaButton } from "@/lib/email";

export async function POST(request: Request) {
  const body = await request.json();
  const { type } = body as { type: "proposed" | "approved" | "denied" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUrl = getAppUrl();
  const resend = getResend();

  if (type === "proposed") {
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

    // Fetch all emails in parallel
    const emails = await Promise.all(
      managers.map((m) => getEmailForUser(supabase, m.id))
    );

    // Send emails + notifications in parallel
    await Promise.all(
      managers.map(async (manager, i) => {
        const email = emails[i];
        await Promise.all([
          email
            ? resend.emails.send({
                from: EMAIL_FROM,
                to: email,
                subject: `Swap request from ${employee.full_name}`,
                html: emailWrapper(`
                  <h2 style="color: #1d4ed8;">Shift swap request</h2>
                  <p>Hi ${manager.full_name.split(" ")[0]},</p>
                  <p><strong>${employee.full_name}</strong> wants to swap their shift on <strong>${shiftDate}</strong> (${shiftTime}) with <strong>${targetName}</strong>.</p>
                  <p>${ctaButton(`${appUrl}/dashboard/swaps`, "Review request")}</p>
                `),
              }).catch(() => {})
            : null,
          supabase.from("notifications").insert({
            recipient_id: manager.id,
            type: "swap_request",
            message: `${employee.full_name} wants to swap their shift on ${shiftDate}.`,
            link: "/dashboard/swaps",
            org_id: shift.org_id,
          }),
        ]);
      })
    );

    return NextResponse.json({ ok: true, sent: emails.filter(Boolean).length });
  }

  if (type === "approved" || type === "denied") {
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
    const statusLabel = type;
    const statusColor = type === "approved" ? "#16a34a" : "#dc2626";

    const email = await getEmailForUser(supabase, requester.id);

    // Send email + notification in parallel
    await Promise.all([
      email
        ? resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject: `Swap request ${statusLabel} — ${shiftDate}`,
            html: emailWrapper(`
              <h2 style="color: ${statusColor};">Swap ${statusLabel}</h2>
              <p>Hi ${requester.full_name.split(" ")[0]},</p>
              <p>Your swap request for <strong>${shiftDate}</strong> (${shiftTime}) has been <strong>${statusLabel}</strong>.</p>
              <p>${ctaButton(`${appUrl}/dashboard/swaps`, "View swaps")}</p>
            `),
          }).catch(() => {})
        : null,
      supabase.from("notifications").insert({
        recipient_id: requester.id,
        type: `swap_${statusLabel}`,
        message: `Your swap request for ${shiftDate} (${shiftTime}) has been ${statusLabel}.`,
        link: "/dashboard/swaps",
        org_id: swap.org_id,
      }),
    ]);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
