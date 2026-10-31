"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n";

export interface MultiFilterOption {
  value: string;
  label: string;
}

/**
 * Filter dropdown yang bisa mencentang beberapa nilai sekaligus. Menu sengaja
 * tidak menutup saat item diklik supaya beberapa pilihan bisa diambil berurutan.
 */
export function MultiFilter({
  label,
  emptyLabel,
  options,
  selected,
  onChange,
}: {
  /** Judul filter, dipakai di label aksesibilitas dan judul menu. */
  label: string;
  /** Teks tombol saat belum ada pilihan, mis. "Semua status". */
  emptyLabel: string;
  options: MultiFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useLanguage();
  const chosen = selected
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .filter((value) => value.length > 0);
  const text =
    chosen.length === 0
      ? emptyLabel
      : chosen.length === 1
        ? chosen[0]
        : `${label} (${chosen.length})`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-auto shrink-0 gap-1.5 font-normal"
            aria-label={`${label}: ${text}`}
          />
        }
      >
        <span className="whitespace-nowrap">{text}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto p-1">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={() => onChange([])}
            >
              {t("tasks.filterClear")}
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            closeOnClick={false}
            onCheckedChange={(next) => {
              onChange(
                next
                  ? [...selected, option.value]
                  : selected.filter((value) => value !== option.value)
              );
            }}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
