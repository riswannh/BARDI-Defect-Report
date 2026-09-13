"use client";

import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";
import type { Factory } from "@/lib/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Menu, ShieldCheck, ShieldAlert, User } from "lucide-react";

export function Header({
  mobileNavOpen,
  onMobileNavOpenChange,
}: {
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
}) {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { data: factories } = useApi<Factory[]>("/api/factories");

  if (!user) return null;

  const factoryName = user.factoryId
    ? factories?.find((f) => f.id === user.factoryId)?.name ?? "-"
    : t("header.allFactories");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-3 shadow-[0_1px_0_0_oklch(0.731_0.104_203.2/0.06)] backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label={t("nav.openMenu")}
          aria-expanded={mobileNavOpen}
          onClick={() => onMobileNavOpenChange(true)}
        >
          <Menu className="size-4" />
        </Button>
        {isAdmin ? (
          <span className="hidden size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15 sm:flex">
            <ShieldCheck className="size-4" />
          </span>
        ) : (
          <span className="hidden size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border sm:flex">
            <ShieldAlert className="size-4" />
          </span>
        )}
        <span className="truncate text-sm font-medium">{factoryName}</span>
      </div>

      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full ring-1 ring-border/60 hover:ring-primary/30"
              />
            }
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/12 text-primary">
              <User className="size-3.5" />
            </span>
            {user.username}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {isAdmin
                  ? t("header.administrator")
                  : t("header.factoryLabel", { name: factoryName })}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <LogOut className="size-4" />
                {t("header.logout")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
