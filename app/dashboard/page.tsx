import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CalendarClock, Users, CalendarOff, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { format, startOfWeek, endOfWeek } from "date-fns";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, location:locations(*)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  // Pending leave requests (for managers/admins)
  let pendingLeaveCount = 0;
  if (profile.role !== "barber") {
    const query = supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (profile.role === "manager" && profile.location_id) {
      // Join to profiles to filter by location
      const { count } = await supabase
        .from("leave_requests")
        .select("id, employee:profiles!leave_requests_employee_id_fkey(location_id)", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("employee.location_id", profile.location_id);
      pendingLeaveCount = count ?? 0;
    } else {
      const { count } = await query;
      pendingLeaveCount = count ?? 0;
    }
  }

  // Pending swaps
  let pendingSwapCount = 0;
  if (profile.role !== "barber") {
    const { count } = await supabase
      .from("shift_swaps")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingSwapCount = count ?? 0;
  }

  // This week's shifts for the current user (barber view)
  let myShiftsThisWeek = 0;
  if (profile.role === "barber") {
    const { count } = await supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", user.id)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("status", "scheduled");
    myShiftsThisWeek = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Good {getTimeGreeting()}, {profile.full_name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          Week of {format(startOfWeek(now, { weekStartsOn: 1 }), "d MMM yyyy")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {profile.role === "barber" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My shifts this week</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myShiftsThisWeek}</div>
            </CardContent>
          </Card>
        ) : null}

        {profile.role !== "barber" && (
          <>
            <Link href="/dashboard/leave">
              <Card className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending leave</CardTitle>
                  <CalendarOff className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingLeaveCount}</div>
                  {pendingLeaveCount > 0 && (
                    <Badge variant="warning" className="mt-1">Needs review</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/swaps">
              <Card className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending swaps</CardTitle>
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingSwapCount}</div>
                  {pendingSwapCount > 0 && (
                    <Badge variant="warning" className="mt-1">Needs review</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/rota">
              <Card className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Rota</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">View & edit this week</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/employees">
              <Card className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Team</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Manage your barbers</p>
                </CardContent>
              </Card>
            </Link>
          </>
        )}
      </div>

      {/* Quick links for barbers */}
      {profile.role === "barber" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/dashboard/my-shifts">
            <Card className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">My Shifts</CardTitle>
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Your upcoming schedule</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/rota">
            <Card className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Full rota</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">See the weekly grid</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/leave">
            <Card className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Request leave</CardTitle>
                <CalendarOff className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Apply for unpaid leave</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
