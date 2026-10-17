"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Deretan KPI tanpa kartu untuk halaman Report.
 *
 * Bentuk lama (kartu di dalam section berbingkai) terlalu ramai: judul kartu
 * mengulang nama section, label dan angka sama-sama kecil, dan angka rupiah
 * panjang memaksa kartu melebar. Di sini tiap topik jadi SATU baris: judul
 * kecil kapital di atas, lalu angka-angka sebaris dipisah garis tipis.
 * Angka penuh disimpan di atribut `title` (hover) — lihat `formatCompactIDR`.
 */

export function KpiGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="px-4 py-3">
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      <div className="flex flex-wrap items-stretch gap-y-2">{children}</div>
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
      className="flex min-w-0 flex-col gap-0.5 border-r border-slate-200 px-4 first:pl-0 last:border-r-0 last:pr-0 dark:border-slate-700"
    >
      <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={cn(
          "font-heading text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100",
          valueClassName
        )}
      >
        {value}
      </span>
    </div>
  );
}
