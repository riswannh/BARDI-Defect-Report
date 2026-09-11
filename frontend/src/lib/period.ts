import { MONTHS } from "@/lib/format";
import type { PeriodType } from "@/lib/types";

export interface PeriodFilter {
  period: PeriodType;
  month: string;
  year: string;
  day: string;
  weekEnd: string;
  from: string;
  to: string;
}

export function monthOf(date: string): string {
  const m = Number(date.slice(5, 7)) - 1;
  return MONTHS[m] ?? "";
}

export function monthsInRange(from: string, to: string): Set<string> {
  const set = new Set<string>();
  if (!from || !to) return set;
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    set.add(MONTHS[d.getMonth()]);
  }
  return set;
}

export function weekRange(weekEnd: string): { start: string; end: string } | null {
  if (!weekEnd) return null;
  const end = new Date(weekEnd);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export function matchesDefectPeriod(
  timestamp: string,
  f: PeriodFilter
): boolean {
  const date = timestamp.slice(0, 10);
  const year = timestamp.slice(0, 4);
  switch (f.period) {
    case "monthly":
      return (
        (f.month === "all" || monthOf(timestamp) === f.month) &&
        (!f.year || year === f.year)
      );
    case "yearly":
      return !f.year || year === f.year;
    case "daily":
      return !f.day || date === f.day;
    case "weekly": {
      const range = weekRange(f.weekEnd);
      if (!range) return true;
      return date >= range.start && date <= range.end;
    }
    case "custom":
      return (!f.from || date >= f.from) && (!f.to || date <= f.to);
    default:
      return true;
  }
}

export function matchesSalePeriod(month: string, f: PeriodFilter): boolean {
  switch (f.period) {
    case "monthly":
      return f.month === "all" || month === f.month;
    case "yearly":
      // Data sales tidak punya tahun — semua sales bulan tsb ditampilkan
      return true;
    case "daily":
      return !f.day || month === monthOf(f.day);
    case "weekly": {
      const range = weekRange(f.weekEnd);
      if (!range) return true;
      return monthsInRange(range.start, range.end).has(month);
    }
    case "custom":
      return monthsInRange(f.from, f.to).has(month);
    default:
      return true;
  }
}
