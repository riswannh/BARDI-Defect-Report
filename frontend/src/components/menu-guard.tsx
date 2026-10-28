"use client";

import { ShieldAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { MENU_HREF, type MenuKey } from "@/lib/permissions";
import { useLanguage } from "@/lib/i18n";

const MATCHERS = (Object.entries(MENU_HREF) as Array<[MenuKey, string]>)
  .map(([menu, href]) => ({ menu, prefix: href }))
  .sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Gerbang menu berbasis hak akses role. Dipasang sekali di layout dashboard
 * supaya setiap halaman ikut aturan role tanpa menambah penjaga di tiap page.
 */
export function MenuGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, profileLoading, user } = useAuth();
  const { t } = useLanguage();

  const match = MATCHERS.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
  );

  if (!match || !user) return <>{children}</>;

  if (profileLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!can(match.menu, "read")) {
    return (
      <div className="flex max-w-lg flex-col items-start gap-2 rounded-xl border border-border bg-card p-6">
        <ShieldAlert className="size-5 text-amber-500" />
        <p className="font-medium">{t("guard.noAccessTitle")}</p>
        <p className="text-sm text-muted-foreground">
          {t("guard.noAccessHint")}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
