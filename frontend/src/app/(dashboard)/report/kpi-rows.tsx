"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * KPI halaman Report: grid 3 kolom tanpa kartu (bukan kartu berbingkai tebal).
 *
 * Tiap topik satu sel: latar tipis + garis 1 px, label kiri dan angka kanan
 * sebaris (`justify-between`) supaya angka besar tidak memaksa kolom melebar.
 * Angka Rupiah diringkas `formatCompactIDR()` dan angka penuh disimpan di
 * atribut `title` (hover).
 */

export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
      {children}
    </div>
  );
}

export function KpiGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/40">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function KpiItem({
  label,
  value,
  title,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  /** Teks hover: angka penuh / keterangan cara hitung. */
  title?: string;
  valueClassName?: string;
}) {
  return (
    <div
      title={title}
      className="flex items-center justify-between gap-3"
    >
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 text-base font-bold tabular-nums text-slate-900 dark:text-slate-100",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}
