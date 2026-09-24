import { MONTHS } from "@/lib/format";
import { normalizeName } from "./mapping";

/**
 * Tab "Data Penjualan" bentuknya tabel lebar (pivot), bukan tabel datar seperti
 * "Big Data":
 *
 *   baris 1: A "Nama Data Penjualan" | B "Official Name" | C "Factory" | D "January 2026" ...
 *   baris 2: sub-header "QTY" / "Value" untuk tiap bulan
 *   baris 3: baris "Total" (dilewati karena Official Name-nya kosong)
 *   baris 4+: satu baris per produk, 12 pasang kolom QTY/Value
 *
 * Jadi satu baris sheet melebar jadi sampai 12 baris tabel `sales` di app
 * (kunci: produk + pabrik + bulan).
 */

export const SALES_FIELDS = ["quantity", "value"] as const;

export type SalesField = (typeof SALES_FIELDS)[number];

export const SALES_FIELD_LABEL: Record<SalesField, string> = {
  quantity: "Quantity",
  value: "Value",
};

export type SalesFields = Partial<Record<SalesField, string>>;

export type SalesLayout = {
  /** Indeks kolom "Official Name" (acuan produk, sesuai keputusan user). */
  official: number;
  /** Indeks kolom "Factory". */
  factory: number;
  months: { month: string; label: string; qtyCol: number; valCol: number }[];
  /** Masalah header yang bikin sync tidak bisa jalan. */
  missing: string[];
};

/** "January 2026" -> "Jan" (format bulan yang dipakai tabel sales). */
export function monthFromLabel(label: unknown): string | null {
  const text = String(label ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const word = text.split(" ")[0].replace(/[^A-Za-z]/g, "");
  if (word.length < 3) return null;
  const short = word.slice(0, 3).toLowerCase();
  const hit = MONTHS.find((m) => m.toLowerCase() === short);
  return hit ?? null;
}

/**
 * Angka dari sheet: dengan UNFORMATTED_VALUE sel angka datang sebagai number,
 * tapi sel teks ("31,185,000.00" / "1.234,56" / "-") tetap mungkin.
 * Koma dianggap desimal hanya kalau diikuti 1-2 digit di ujung dan tidak ada
 * titik; selain itu koma/titik diperlakukan sebagai pemisah ribuan.
 */
export function parseSalesNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean" || value == null) return 0;
  let text = String(value).trim();
  if (!text) return 0;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()\s\u00a0]/g, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const commaDecimal = /,\d{1,2}$/.test(text);
  if (lastComma > lastDot && commaDecimal) text = text.replace(/\./g, "").replace(",", ".");
  else if (lastDot >= 0) text = text.replace(/,/g, "");
  else if (commaDecimal) text = text.replace(",", ".");
  else text = text.replace(/,/g, "");
  const n = Number.parseFloat(text.replace(/[^\d.\-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

/** Cari kolom Official Name, Factory, dan pasangan QTY/Value tiap bulan. */
export function resolveSalesLayout(header: unknown[], sub: unknown[]): SalesLayout {
  const at = (row: unknown[], name: string) =>
    row.findIndex((cell) => normalizeName(String(cell ?? "")) === normalizeName(name));

  const official = at(header, "Official Name");
  const factory = at(header, "Factory");
  const missing: string[] = [];
  if (official < 0) missing.push('kolom "Official Name"');
  if (factory < 0) missing.push('kolom "Factory"');

  const months: SalesLayout["months"] = [];
  header.forEach((cell, i) => {
    const month = monthFromLabel(cell);
    if (!month) return;
    const qty = normalizeName(String(sub[i] ?? ""));
    const val = normalizeName(String(sub[i + 1] ?? ""));
    if (qty !== "qty" || val !== "value") {
      missing.push(`sub-header bulan ${JSON.stringify(String(cell))} bukan QTY/Value`);
      return;
    }
    if (months.some((m) => m.month === month)) return;
    months.push({ month, label: String(cell).replace(/\s+/g, " ").trim(), qtyCol: i, valCol: i + 1 });
  });
  if (months.length === 0) missing.push("tidak ada kolom bulan (mis. \"January 2026\")");

  return { official, factory, months, missing };
}

/** Kunci baris sales di app: produk + pabrik + bulan (sama dengan unique index DB). */
export const salesRowKey = (productId: number, factoryId: number, month: string) =>
  `${productId}|${factoryId}|${month}`;
