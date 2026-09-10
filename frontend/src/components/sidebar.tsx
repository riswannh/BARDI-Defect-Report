"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import {
  LayoutDashboard,
  ShoppingCart,
  AlertTriangle,
  Database,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/report", labelKey: "nav.report", icon: LayoutDashboard },
  { href: "/sales", labelKey: "nav.sales", icon: ShoppingCart },
  { href: "/defects", labelKey: "nav.defects", icon: AlertTriangle },
  { href: "/master", labelKey: "nav.master", icon: Database, adminOnly: true },
  { href: "/users", labelKey: "nav.users", icon: Users, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  const items = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="relative flex w-60 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-gradient-to-b from-[oklch(0.375_0.058_213)] via-[oklch(0.33_0.052_215)] to-[oklch(0.26_0.042_216)] text-sidebar-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full bg-[oklch(0.731_0.104_203.2/0.22)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-24 size-64 rounded-full bg-[oklch(0.731_0.104_203.2/0.14)] blur-3xl"
      />

      <div className="relative flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-lg shadow-black/20 ring-1 ring-white/40">
          <Image
            src="/logo.png"
            alt="Logo"
            width={36}
            height={36}
            className="size-8 object-contain"
            priority
          />
        </span>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="font-heading text-sm font-semibold tracking-tight text-white">
            {t("nav.brand")}
          </span>
          <span className="text-[10px] font-medium tracking-widest text-white/50 uppercase">
            Analysis
          </span>
        </div>
      </div>

      <nav className="relative flex flex-1 flex-col gap-1 p-3">
        {items.map((item, index) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ animationDelay: `${index * 40}ms` }}
              className={cn(
                "group animate-fade-in-up relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white/14 text-white shadow-inner ring-1 ring-white/15"
                  : "text-white/70 hover:translate-x-0.5 hover:bg-white/8 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[oklch(0.816_0.084_204.3)] transition-all duration-200",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                )}
              />
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition-colors duration-200",
                  active
                    ? "bg-[oklch(0.731_0.104_203.2/0.28)] text-white"
                    : "bg-white/6 text-white/70 group-hover:bg-white/12 group-hover:text-white"
                )}
              >
                <Icon className="size-4" />
              </span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2 text-[11px] text-white/70 ring-1 ring-white/10">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              isAdmin
                ? "bg-[oklch(0.816_0.084_204.3)] shadow-[0_0_8px_oklch(0.816_0.084_204.3)]"
                : "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
            )}
          />
          {isAdmin ? t("nav.adminAccess") : t("nav.factoryAccess")}
        </div>
      </div>
    </aside>
  );
}
