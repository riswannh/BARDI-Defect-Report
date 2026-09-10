"use client";

import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { factories } from "@/lib/mock-data";
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
import { LogOut, ShieldCheck, ShieldAlert, User } from "lucide-react";

export function Header() {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useLanguage();

  if (!user) return null;

  const factoryName = user.factoryId
    ? factories.find((f) => f.id === user.factoryId)?.name ?? "-"
    : t("header.allFactories");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/70 px-6 shadow-[0_1px_0_0_oklch(0.731_0.104_203.2/0.06)] backdrop-blur-md">
      <div className="flex items-center gap-2">
        {isAdmin ? (
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <ShieldCheck className="size-4" />
          </span>
        ) : (
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
            <ShieldAlert className="size-4" />
          </span>
        )}
        <span className="text-sm font-medium">{factoryName}</span>
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
