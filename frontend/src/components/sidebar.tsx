"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import {
  LayoutDashboard,
  ShoppingCart,
  AlertTriangle,
  Database,
  Users,
  Factory,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/report", label: "Report", icon: LayoutDashboard },
  { href: "/sales", label: "Data Sales", icon: ShoppingCart },
  { href: "/defects", label: "Data Defect", icon: AlertTriangle },
  { href: "/master", label: "Data Master", icon: Database, adminOnly: true },
  { href: "/users", label: "User Management", icon: Users, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const items = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Factory className="size-5 text-primary" />
        <span className="font-heading text-sm font-semibold">
          Defect &amp; Sales
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 text-xs text-muted-foreground">
        {isAdmin ? "Admin — akses penuh" : "Pabrik — akses terbatas"}
      </div>
    </aside>
  );
}
