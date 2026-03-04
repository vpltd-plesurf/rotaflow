"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ProfileWithLocation } from "@/lib/supabase/types";

const profileSchema = z.object({
  fullName: z.string().min(2, "Name required"),
  phone: z.string().optional().default(""),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

interface SettingsPageClientProps {
  profile: ProfileWithLocation;
  email: string;
}

export function SettingsPageClient({ profile, email }: SettingsPageClientProps) {
  const supabase = createClient();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: profile.full_name, phone: profile.phone ?? "" },
  });

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  async function onProfileSave(values: ProfileForm) {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: values.fullName, phone: values.phone || null, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ title: "Profile updated" });
  }

  async function onPasswordSave(values: PasswordForm) {
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ title: "Password updated" });
    passwordForm.reset();
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onProfileSave)} className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
            </div>
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input {...profileForm.register("fullName")} />
              {profileForm.formState.errors.fullName && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.fullName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input {...profileForm.register("phone")} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Input value={profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} disabled />
            </div>
            {profile.location && (
              <div className="space-y-1">
                <Label>Location</Label>
                <Input value={profile.location.name} disabled />
              </div>
            )}
            <Button type="submit" disabled={profileForm.formState.isSubmitting}>
              {profileForm.formState.isSubmitting ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSave)} className="space-y-4">
            <div className="space-y-1">
              <Label>New password</Label>
              <Input type="password" {...passwordForm.register("password")} />
              {passwordForm.formState.errors.password && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Confirm password</Label>
              <Input type="password" {...passwordForm.register("confirmPassword")} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
