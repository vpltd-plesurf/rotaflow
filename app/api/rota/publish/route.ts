import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { format } from "date-fns";

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { rotaId } = await request.json();
  if (!rotaId) return NextResponse.json({ error: "rotaId required" }, { status: 400 });

  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get rota + location
  const { data: rota } = await supabase
    .from("rotas")
    .select("*, location:locations(*)")
    .eq("id", rotaId)
    .single();
  if (!rota) return NextResponse.json({ error: "Rota not found" }, { status: 404 });

  // Get barbers at this location
  const { data: barbers } = await supabase
    .from("profiles")
    .select("*")
    .eq("location_id", rota.location_id)
    .eq("role", "barber");

  if (!barbers?.length) return NextResponse.json({ ok: true, sent: 0 });

  // Get their auth emails
  const weekFormatted = format(new Date(rota.week_start + "T00:00:00"), "d MMMM yyyy");
  const locationName = (rota.location as { name: string }).name;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Send emails
  let sent = 0;
  for (const barber of barbers) {
    const { data: authUser } = await supabase.auth.admin.getUserById(barber.id);
    const email = authUser?.user?.email;
    if (!email) continue;

    try {
      await resend.emails.send({
        from: "RotaFlow <no-reply@rotaflow.app>",
        to: email,
        subject: `Your rota for the week of ${weekFormatted} — ${locationName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1d4ed8;">Your rota is ready</h2>
            <p>Hi ${barber.full_name.split(" ")[0]},</p>
            <p>The rota for <strong>${locationName}</strong> — week of <strong>${weekFormatted}</strong> has been published.</p>
            <p>
              <a href="${appUrl}/dashboard/rota" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                View your rota
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">
              You received this email because you are on the team at ${locationName}.
            </p>
          </div>
        `,
      });
      sent++;
    } catch {
      // Don't fail the whole request if one email fails
    }
  }

  return NextResponse.json({ ok: true, sent });
}
