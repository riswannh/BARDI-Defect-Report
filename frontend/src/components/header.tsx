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
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        {isAdmin ? (
          <ShieldCheck className="size-4 text-primary" />
        ) : (
          <ShieldAlert className="size-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{factoryName}</span>
      </div>

      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <User className="size-4" />
            {user.username}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
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
