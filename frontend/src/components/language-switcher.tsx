"use client";

import { LANGUAGES, useLanguage } from "@/lib/i18n";
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
import { Check, Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const current = LANGUAGES.find((l) => l.value === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <Globe className="size-4" />
        {current?.short ?? "ID"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("header.language")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {LANGUAGES.map((l) => (
            <DropdownMenuItem key={l.value} onClick={() => setLanguage(l.value)}>
              {l.label}
              {language === l.value && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
