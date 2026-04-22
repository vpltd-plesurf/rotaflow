import { Resend } from "resend";

let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

export const EMAIL_FROM = "ROKRota <noreply@rokrota.com>";

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Look up a user's email address via Supabase Auth admin API */
export async function getEmailForUser(
  supabase: { auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string } | null } }> } } },
  userId: string
): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

/** Wrap email body content in standard HTML shell */
export function emailWrapper(content: string): string {
  return `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">${content}</div>`;
}

/** Generate a styled CTA button */
export function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${label}</a>`;
}
