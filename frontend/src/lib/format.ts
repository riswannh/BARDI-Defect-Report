const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("id-ID");

export function formatIDR(value: number): string {
  return idrFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/* ============================ PO: mata uang ============================ */

/** Mata uang yang didukung modul PO Product. */
export const PO_CURRENCIES = ["Rp", "USD", "RMB"] as const;
export type PoCurrency = (typeof PO_CURRENCIES)[number];

/**
 * Format angka dengan mata uang PO.
 *
 * `Intl` dipakai supaya pemisah ribuan dan posisi simbolnya benar per mata uang
 * (Rp 1.500.000 vs $2,400 vs ¥17,000), bukan sekadar menempelkan kode.
 */
const poFormatters: Record<PoCurrency, Intl.NumberFormat> = {
  Rp: new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }),
  USD: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }),
  RMB: new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }),
};

/** Terima "rp"/"idr"/"cny" dan spasi berlebih; kembalikan kode baku. */
export function normalizePoCurrency(value: unknown): PoCurrency {
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (s === "USD" || s === "US$" || s === "$") return "USD";
  if (s === "RMB" || s === "CNY" || s === "¥" || s === "￥") return "RMB";
  return "Rp";
}

/** Total + simbol mata uang, mis. "Rp 1.500.000" — dipakai kolom Total Currency. */
export function formatPoCurrency(value: number, currency: unknown): string {
  return poFormatters[normalizePoCurrency(currency)].format(
    Number.isFinite(value) ? value : 0
  );
}

/**
 * Bentuk ringkas untuk kolom tabel, mis. "Rp 222 jt" atau "$1,2 rb".
 *
 * Kolom Price/pcs dan Total Currency di tabel PO sempit, dan angka Rupiah penuh
 * (Rp 222.000.000) membuat tabel melebar sampai header terpotong. Bentuk penuh
 * tetap dipakai di form dan di mana pun angkanya perlu dibaca persis.
 */
const poCompactFormatters: Record<PoCurrency, Intl.NumberFormat> = {
  Rp: new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }),
  USD: new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }),
  RMB: new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }),
};

const PO_SYMBOLS: Record<PoCurrency, string> = {
  Rp: "Rp ",
  USD: "$",
  RMB: "¥",
};

export function formatPoCurrencyCompact(
  value: number,
  currency: unknown
): string {
  const code = normalizePoCurrency(currency);
  const safe = Number.isFinite(value) ? value : 0;
  return `${PO_SYMBOLS[code]}${poCompactFormatters[code].format(safe)}`;
}

export function formatDateTime(value: string): string {
  return value.replace("T", " ");
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const MONTHS_FULL = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export function monthIndex(month: string): number {
  return MONTHS.indexOf(month as (typeof MONTHS)[number]);
}
