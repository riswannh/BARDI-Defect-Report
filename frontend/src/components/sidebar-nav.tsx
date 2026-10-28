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
  ClipboardList,
  Headset,
  ShieldCheck,
  Wrench,
  ListTodo,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { MenuKey } from "@/lib/permissions";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  menu: MenuKey;
}

const navItems: NavItem[] = [
  { href: "/report", labelKey: "nav.report", menu: "report", icon: LayoutDashboard },
  {
    href: "/sales",
    labelKey: "nav.sales", menu: "sales",
    icon: ShoppingCart,  },
  // PO Product juga dibuka untuk role Pabrik (read-only, tanpa harga/total).
  { href: "/po", labelKey: "nav.po", menu: "po", icon: ClipboardList },
  // Ticketing dipakai CS, Tim Produk, dan Tim Pabrik — bukan admin-only.
  { href: "/tickets", labelKey: "nav.tickets", menu: "tickets", icon: Headset },
  // Task planner terbuka untuk semua tim; akses tetap mengikuti matriks role.
  { href: "/tasks", labelKey: "nav.tasks", menu: "tasks", icon: ListTodo },
  {
    href: "/defects",
    labelKey: "nav.defects", menu: "defects",
    icon: AlertTriangle,  },
  {
    href: "/repairs",
    labelKey: "nav.repairs", menu: "repairs",
    icon: Wrench,  },
  {
    href: "/claim-garansi",
    labelKey: "nav.warrantyClaims", menu: "claim-garansi",
    icon: ShieldCheck,  },
  { href: "/master", labelKey: "nav.master", menu: "master", icon: Database },
  { href: "/users", labelKey: "nav.users", menu: "users", icon: Users },
];

/**
 * Isi navigasi, dipakai oleh sidebar tetap (>=lg) dan sheet navigasi (<lg).
 * `onNavigate` dipakai sheet untuk menutup dirinya setelah menu dipilih.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isAdmin, can, roleName, profileLoading } = useAuth();
  const { t } = useLanguage();

  // Menu yang tidak boleh dibaca role ini disembunyikan; selama profil belum
  // datang, semua item ditahan supaya tidak berkedip-kedip.
  const items = profileLoading
    ? []
    : navItems.filter((item) => can(item.menu, "read"));

  return (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-white/40">
          <Image
            src="/logo.png"
            alt="Logo"
            width={36}
            height={36}
            className="size-9 object-cover"
            priority
          />
        </span>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="font-heading text-sm font-semibold tracking-tight text-white">
            {t("nav.brand")}
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                active
                  ? "bg-white/14 text-white ring-1 ring-white/15"
                  : "text-white/70 hover:bg-white/8 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[oklch(0.816_0.084_204.3)] transition-opacity duration-200",
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

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2 text-[11px] text-white/70 ring-1 ring-white/10">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              isAdmin
                ? "bg-[oklch(0.816_0.084_204.3)]"
                : "bg-amber-400"
            )}
          />
          {isAdmin
            ? t("nav.adminAccess")
            : (roleName ?? t("nav.factoryAccess"))}
        </div>
      </div>
    </>
  );
}
