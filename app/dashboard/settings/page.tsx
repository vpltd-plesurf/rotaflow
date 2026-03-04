import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  return <SettingsPageClient profile={profile as never} email={user.email ?? ""} />;
}
