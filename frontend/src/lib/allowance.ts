import { weekRange, type PeriodFilter } from "@/lib/period";

/**
 * Limit allowance defect: angka Rupiah SETAHUN yang diisi admin di Data Master,
 * diprorata mengikuti periode filter halaman Report lalu dikurangi nilai defect
 * periode itu.
 *
 * Aturan prorata (dari user, dengan satu koreksi):
 * - yearly          → limit penuh
 * - monthly         → limit / 12 (bulan "all" berarti setahun penuh → penuh)
 * - weekly          → limit / 12 / 4,33 (≈ limit / 52) — "dibagi 4,33" dibaca
 *                     sebagai bagian BULAN dibagi 4,33; memakai limit/4,33
 *                     langsung berarti 23% limit tahunan untuk satu minggu
 * - daily           → limit / 365
 * - custom          → limit × jumlah hari rentang / 365
 *
 * Tahun yang dipakai = tahun TERBARU di dalam filter (filter yang melewati dua
 * tahun memakai limit tahun terbaru). Kalau filter tidak menyebut tahun sama
 * sekali, dipakai tahun terbaru yang punya baris limit.
 */

/** Minggu per tahun menurut aturan user: 12 bulan × 4,33 minggu. */
const WEEKS_PER_YEAR = 12 * 4.33;

/** Pembagi limit tahunan untuk periode harian dan rentang tanggal. */
const DAYS_PER_YEAR = 365;

const DAY_MS = 86_400_000;

export interface AllowanceRow {
  year: string;
  limitValue: number;
}

export interface AllowanceResult {
  /** Tahun limit yang dipakai (boleh berbeda dari tahun filter terbaru). */
  year: string;
  /** Limit tahunan setelah diprorata ke periode filter — Rupiah. */
  prorated: number;
}

/** "YYYY-MM-DD" dari input tanggal halaman Report. */
function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function yearOf(date: string): string {
  return date.slice(0, 4);
}

/** Tahun yang diminta filter; "" kalau filter tidak menyebut tahun. */
export function allowanceTargetYear(f: PeriodFilter): string {
  switch (f.period) {
    case "daily":
      return isDate(f.day) ? yearOf(f.day) : "";
    case "weekly": {
      // Rentang minggu bisa melewati pergantian tahun → ambil tahun terbaru.
      const range = weekRange(f.weekEnd);
      if (!range) return "";
      return yearOf(range.start) > yearOf(range.end)
        ? yearOf(range.start)
        : yearOf(range.end);
    }
    case "custom": {
      const years = [f.from, f.to].filter(isDate).map(yearOf);
      return years.length === 0
        ? ""
        : years.reduce((latest, value) => (value > latest ? value : latest));
    }
    default:
      return /^\d{4}$/.test(f.year) ? f.year : "";
  }
}

/**
 * Jumlah hari rentang custom, inklusif kedua ujungnya.
 *
 * Satu batas yang kosong dilengkapi ke ujung tahun batas yang ada; dua-duanya
 * kosong berarti seluruh tahun (365 hari).
 */
function customDays(f: PeriodFilter): number {
  const from = isDate(f.from) ? f.from : "";
  const to = isDate(f.to) ? f.to : "";
  if (!from && !to) return DAYS_PER_YEAR;
  const start = from || `${yearOf(to)}-01-01`;
  const end = to || `${yearOf(start)}-12-31`;
  const days =
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS
    ) + 1;
  return days > 0 ? days : 0;
}

/** Bagian limit tahunan yang berlaku untuk periode filter (0..1). */
export function prorationFactor(f: PeriodFilter): number {
  switch (f.period) {
    case "monthly":
      return f.month === "all" ? 1 : 1 / 12;
    case "weekly":
      return 1 / WEEKS_PER_YEAR;
    case "daily":
      return 1 / DAYS_PER_YEAR;
    case "custom":
      return customDays(f) / DAYS_PER_YEAR;
    default:
      return 1;
  }
}

export function proratedLimit(limitValue: number, f: PeriodFilter): number {
  return limitValue * prorationFactor(f);
}

/** Tahun terbaru yang punya baris limit. */
function latestYear(rows: AllowanceRow[]): string {
  return rows.reduce(
    (latest, row) => (row.year > latest ? row.year : latest),
    rows[0].year
  );
}

/**
 * Tahun limit yang akan dipakai untuk filter ini — tetap diisi walau tahun itu
 * belum punya baris limit, supaya UI bisa menyebut tahun yang perlu diisi.
 */
export function allowanceYearFor(rows: AllowanceRow[], f: PeriodFilter): string {
  if (rows.length === 0) return allowanceTargetYear(f);
  const target = allowanceTargetYear(f);
  return target || latestYear(rows);
}

/**
 * Limit prorata untuk periode filter, atau `null` kalau tahun yang dituju belum
 * punya baris limit (UI menampilkan "-", bukan diam-diam memakai tahun lain).
 */
export function findAllowance(
  rows: AllowanceRow[],
  f: PeriodFilter
): AllowanceResult | null {
  if (rows.length === 0) return null;
  const year = allowanceYearFor(rows, f);
  const row = rows.find((item) => item.year === year);
  if (!row) return null;
  return { year: row.year, prorated: proratedLimit(row.limitValue, f) };
}
