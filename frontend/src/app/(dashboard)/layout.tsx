"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { AuthGuard } from "@/components/auth-guard";
import { MenuGuard } from "@/components/menu-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full shrink-0 overflow-hidden">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          mobileNavOpen={mobileNavOpen}
          onMobileNavOpenChange={setMobileNavOpen}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <AuthGuard>
            <MenuGuard>{children}</MenuGuard>
          </AuthGuard>
        </main>
      </div>
    </div>
  );
}
