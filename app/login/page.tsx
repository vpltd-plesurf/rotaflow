import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50/60 to-teal-50/40 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-md">
            RR
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ROKRota</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Made for barbers, built by barbers</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
        </div>
        <div className="rounded-2xl border bg-card shadow-lg p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
