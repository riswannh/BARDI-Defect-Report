"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * KPI halaman Report: grid 3 kolom berisi kartu putih berelevasi tipis.
 *
 * Tiap topik satu kartu (`bg-white` + `border-slate-100` + shadow halus),
 * isinya baris label kiri dan angka kanan (`justify-between`) dipisah garis
 * 1 px `border-slate-50` kecuali baris terakhir supaya angka besar tidak
 * memaksa kolom melebar. Angka Rupiah diringkas `formatCompactIDR()` dan angka
 * penuh disimpan di atribut `title` (hover).
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
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_1px_3px_-1px_rgba(0,0,0,0.03)] dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      <div>{children}</div>
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
  title?: string;
  valueClassName?: string;
}) {
  return (
    <div
      title={title}
      className="flex items-center justify-between gap-3 border-b border-slate-50 py-2.5 last:border-none dark:border-slate-800"
    >
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 text-base font-extrabold tabular-nums text-slate-900 dark:text-slate-100",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Warna angka selisih/sisa: minus (`text-rose-600`), plus (`text-emerald-600`),
 * nol abu netral. Dipakai di baris KPI supaya kontrasnya sama untuk semua kartu.
 */
export function selisihTone(value: number): string {
  if (value < 0) return "text-rose-600 dark:text-rose-400";
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}
