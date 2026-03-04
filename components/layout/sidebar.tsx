"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Users,
  MapPin,
  CalendarOff,
  ArrowLeftRight,
  FileText,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileWithLocation } from "@/lib/supabase/types";

interface SidebarProps {
  profile: ProfileWithLocation;
}

const navItems = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["admin", "manager", "barber"],
  },
  {
    href: "/dashboard/rota",
    label: "Rota",
    icon: CalendarDays,
    roles: ["admin", "manager", "barber"],
  },
  {
    href: "/dashboard/employees",
    label: "Team",
    icon: Users,
    roles: ["admin", "manager"],
  },
  {
    href: "/dashboard/leave",
    label: "Leave",
    icon: CalendarOff,
    roles: ["admin", "manager", "barber"],
  },
  {
    href: "/dashboard/swaps",
    label: "Swaps",
    icon: ArrowLeftRight,
    roles: ["admin", "manager", "barber"],
  },
  {
    href: "/dashboard/documents",
    label: "Documents",
    icon: FileText,
    roles: ["admin", "manager", "barber"],
  },
  {
    href: "/dashboard/locations",
    label: "Locations",
    icon: MapPin,
    roles: ["admin"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    roles: ["admin", "manager"],
  },
];

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(profile.role)
  );

  return (
    <aside className="hidden w-56 flex-col border-r bg-card md:flex">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4 gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
          RF
        </div>
        <span className="font-semibold text-sm">RotaFlow</span>
      </div>

      {/* Location label */}
      {profile.location && (
        <div className="px-4 py-2 border-b">
          <p className="text-xs text-muted-foreground truncate">
            {profile.location.name}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t p-4">
        <p className="text-xs font-medium truncate">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
      </div>
    </aside>
  );
}
