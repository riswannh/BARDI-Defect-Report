"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/lib/i18n";

/**
 * Navigasi utama.
 *
 * - Layar lebar (>=lg): sidebar tetap 240px seperti sebelumnya.
 * - Layar sempit: sidebar tetap disembunyikan, navigasi dipindah ke sheet yang
 *   dibuka lewat tombol menu di header. Sebelumnya sidebar 240px memakan lebih
 *   dari separuh lebar HP sehingga konten tidak terbaca.
 */
export function Sidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();

  // Tutup sheet setiap kali rute berubah (mis. tombol kembali browser).
  useEffect(() => {
    onMobileOpenChange(false);
  }, [pathname, onMobileOpenChange]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <>
      <aside className="relative hidden w-60 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-gradient-to-b from-[oklch(0.375_0.058_213)] via-[oklch(0.33_0.052_215)] to-[oklch(0.26_0.042_216)] text-sidebar-foreground lg:flex">
        <SidebarNav />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          className="bg-gradient-to-b from-[oklch(0.375_0.058_213)] via-[oklch(0.33_0.052_215)] to-[oklch(0.26_0.042_216)] p-0 lg:hidden"
          aria-label={t("nav.brand")}
        >
          <SheetTitle className="sr-only">{t("nav.brand")}</SheetTitle>
          <SidebarNav onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
