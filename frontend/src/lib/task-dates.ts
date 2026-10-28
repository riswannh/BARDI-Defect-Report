/**
 * Utilitas tanggal untuk Task Planner.
 *
 * Tanggal disimpan sebagai teks "YYYY-MM-DD" (tanggal murni), jadi semua
 * perhitungan memakai komponen UTC supaya tidak bergeser oleh zona waktu
 * browser/server. Tidak memakai library tanggal tambahan.
 */

export interface RepeatRuleInput {
  dueDate: string;
  repeatRule: string;
  repeatWeekday?: number | null;
  repeatDay?: number | null;
}

export function isoToDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dateToISO(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Tanggal hari ini menurut jam lokal operator (bukan UTC). */
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = isoToDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToISO(date);
}

/** 1=Senin … 7=Minggu. */
export function isoWeekday(iso: string): number {
  const day = isoToDate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Tanggal deadline berikutnya untuk task repeatable; `null` kalau tidak
 * berulang. Bulan pendek di-clamp ke hari terakhir (tanggal 31 → 28/29 Feb).
 */
export function nextOccurrence(input: RepeatRuleInput): string | null {
  if (!input.repeatRule) return null;

  if (input.repeatRule === "daily") return addDays(input.dueDate, 1);

  if (input.repeatRule === "weekly") {
    const target = input.repeatWeekday ?? isoWeekday(input.dueDate);
    let candidate = addDays(input.dueDate, 1);
    for (let step = 0; step < 7; step += 1) {
      if (isoWeekday(candidate) === target) return candidate;
      candidate = addDays(candidate, 1);
    }
    return candidate;
  }

  // monthly
  const [year, month, day] = input.dueDate.split("-").map(Number);
  const targetDay = input.repeatDay ?? day;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const clamped = Math.min(targetDay, daysInMonth(nextYear, nextMonth));
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

export interface CalendarDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

/**
 * Grid kalender satu bulan (7 kolom, mulai Senin). Sel di luar bulan tetap
 * disertakan supaya baris pertama/terakhir tidak bolong.
 */
export function monthGrid(year: number, month: number): CalendarDay[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const leading = isoWeekday(first) - 1;
  const start = addDays(first, -leading);
  const total = daysInMonth(year, month);

  const cells: CalendarDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const iso = addDays(start, index);
    const [cellYear, cellMonth, cellDay] = iso.split("-").map(Number);
    cells.push({
      iso,
      day: cellDay,
      inMonth: cellYear === year && cellMonth === month,
    });
    if (index >= 34 && iso.endsWith(`-${String(total).padStart(2, "0")}`) && cellMonth === month) {
      // Baris terakhir sudah mencakup tanggal akhir bulan.
      break;
    }
  }
  return cells;
}

/** Apakah tanggal `iso` berada di dalam rentang [start, end]. */
export function isWithin(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

/** Format tampilan ringkas "2026-10-08" → "08 Okt 2026". */
export function formatTaskDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  if (!year || !month || !day) return iso;
  return `${String(day).padStart(2, "0")} ${names[month - 1]} ${year}`;
}

/** Stempel log "2026-10-28T05:17:53.000Z" → "28 Okt 2026 12:17" (jam lokal). */
export function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number) => String(input).padStart(2, "0");
  const localISO = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${formatTaskDate(localISO)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
