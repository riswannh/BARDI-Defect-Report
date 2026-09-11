import { MONTHS, MONTHS_FULL } from "@/lib/format";
import { monthOf, weekRange, type PeriodFilter } from "@/lib/period";
import type { Defect, Product, Sale } from "@/lib/types";

export interface ProductRecapRow {
  productId: number;
  productName: string;
  defectQty: number;
  defectValue: number;
  salesQty: number;
  salesValue: number;
  ratio: number | null;
}

export interface ChartBucket {
  label: string;
  defectQty: number;
  defectValue: number;
  salesQty: number;
  salesValue: number;
}

export function productName(products: Product[], id: number): string {
  return products.find((p) => p.id === id)?.name ?? "-";
}

export function summarizeByProduct(
  defects: Defect[],
  sales: Sale[],
  products: Product[]
): ProductRecapRow[] {
  const rows = new Map<number, ProductRecapRow>();

  for (const p of products) {
    rows.set(p.id, {
      productId: p.id,
      productName: p.name,
      defectQty: 0,
      defectValue: 0,
      salesQty: 0,
      salesValue: 0,
      ratio: null,
    });
  }

  for (const d of defects) {
    const row = rows.get(d.productId);
    if (row) {
      row.defectQty += d.quantity;
      row.defectValue += d.value;
    }
  }

  for (const s of sales) {
    const row = rows.get(s.productId);
    if (row) {
      row.salesQty += s.quantity;
      row.salesValue += s.value;
    }
  }

  for (const row of rows.values()) {
    row.ratio = row.salesQty > 0 ? row.defectQty / row.salesQty : null;
  }

  return Array.from(rows.values());
}

export function totalDefectQty(defects: Defect[]): number {
  return defects.reduce((sum, d) => sum + d.quantity, 0);
}

export function totalDefectValue(defects: Defect[]): number {
  return defects.reduce((sum, d) => sum + d.value, 0);
}

export function totalSalesQty(sales: Sale[]): number {
  return sales.reduce((sum, s) => sum + s.quantity, 0);
}

export function totalSalesValue(sales: Sale[]): number {
  return sales.reduce((sum, s) => sum + s.value, 0);
}

const MAX_CHART_BUCKETS = 12;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayCount(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

function dayLabel(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  return `${d} ${MONTHS_FULL[m]} ${y}`;
}

function rangeLabel(start: string, end: string): string {
  if (start === end) return dayLabel(start);
  const sy = Number(start.slice(0, 4));
  const sm = Number(start.slice(5, 7)) - 1;
  const sd = Number(start.slice(8, 10));
  const ey = Number(end.slice(0, 4));
  const em = Number(end.slice(5, 7)) - 1;
  const ed = Number(end.slice(8, 10));
  if (sy === ey && sm === em) return `${sd}-${ed} ${MONTHS_FULL[sm]} ${sy}`;
  if (sy === ey)
    return `${sd} ${MONTHS_FULL[sm]} - ${ed} ${MONTHS_FULL[em]} ${sy}`;
  return `${sd} ${MONTHS_FULL[sm]} ${sy} - ${ed} ${MONTHS_FULL[em]} ${ey}`;
}

function buildHourlyBuckets(
  defects: Defect[],
  sales: Sale[],
  day: string
): ChartBucket[] {
  if (!day) return [];

  const labels = Array.from({ length: MAX_CHART_BUCKETS }, (_, i) => {
    const start = pad2(i * 2);
    const end = pad2((i + 1) * 2);
    return `${start}:00 - ${end}:00`;
  });

  const defectQty = Array.from({ length: MAX_CHART_BUCKETS }, () => 0);
  const defectValue = Array.from({ length: MAX_CHART_BUCKETS }, () => 0);
  for (const d of defects) {
    if (d.timestamp.slice(0, 10) !== day) continue;
    const hour = Number(d.timestamp.slice(11, 13));
    if (Number.isNaN(hour)) continue;
    const idx = Math.min(MAX_CHART_BUCKETS - 1, Math.floor(hour / 2));
    defectQty[idx] += d.quantity;
    defectValue[idx] += d.value;
  }

  const targetMonth = monthOf(day);
  let monthSalesQty = 0;
  let monthSalesValue = 0;
  for (const s of sales) {
    if (s.month === targetMonth) {
      monthSalesQty += s.quantity;
      monthSalesValue += s.value;
    }
  }

  return labels.map((label, i) => ({
    label,
    defectQty: defectQty[i],
    defectValue: defectValue[i],
    salesQty: monthSalesQty,
    salesValue: monthSalesValue,
  }));
}

function monthIndexOf(month: string): number {
  return MONTHS.indexOf(month as (typeof MONTHS)[number]);
}

export function buildYearlyBuckets(
  defects: Defect[],
  sales: Sale[],
  year: string
): ChartBucket[] {
  const buckets = MONTHS.map((month) => ({
    label: month,
    defectQty: 0,
    defectValue: 0,
    salesQty: 0,
    salesValue: 0,
  }));

  for (const d of defects) {
    if (year && d.timestamp.slice(0, 4) !== year) continue;
    const idx = monthIndexOf(monthOf(d.timestamp));
    if (idx >= 0) {
      buckets[idx].defectQty += d.quantity;
      buckets[idx].defectValue += d.value;
    }
  }

  for (const s of sales) {
    const idx = monthIndexOf(s.month);
    if (idx >= 0) {
      buckets[idx].salesQty += s.quantity;
      buckets[idx].salesValue += s.value;
    }
  }

  return buckets;
}

function buildDayRanges(
  from: string,
  to: string
): { label: string; start: string; end: string }[] {
  const total = dayCount(from, to);
  if (total <= 0) return [];
  const bucketCount = Math.min(total, MAX_CHART_BUCKETS);
  const base = Math.floor(total / bucketCount);
  const extra = total % bucketCount;
  const ranges: { label: string; start: string; end: string }[] = [];
  let cursor = 0;
  for (let i = 0; i < bucketCount; i++) {
    const size = base + (i < extra ? 1 : 0);
    const start = addDays(from, cursor);
    const end = addDays(from, cursor + size - 1);
    ranges.push({ label: rangeLabel(start, end), start, end });
    cursor += size;
  }
  return ranges;
}

function buildRangeBuckets(
  defects: Defect[],
  sales: Sale[],
  ranges: { label: string; start: string; end: string }[],
  targetMonth: string
): ChartBucket[] {
  const buckets = ranges.map((r) => ({
    label: r.label,
    start: r.start,
    end: r.end,
    defectQty: 0,
    defectValue: 0,
    salesQty: 0,
    salesValue: 0,
  }));

  for (const d of defects) {
    const date = d.timestamp.slice(0, 10);
    const bucket = buckets.find((b) => date >= b.start && date <= b.end);
    if (bucket) {
      bucket.defectQty += d.quantity;
      bucket.defectValue += d.value;
    }
  }

  let monthQty = 0;
  let monthValue = 0;
  for (const s of sales) {
    if (s.month === targetMonth) {
      monthQty += s.quantity;
      monthValue += s.value;
    }
  }
  for (const b of buckets) {
    b.salesQty = monthQty;
    b.salesValue = monthValue;
  }

  return buckets.map((b) => ({
    label: b.label,
    defectQty: b.defectQty,
    defectValue: b.defectValue,
    salesQty: b.salesQty,
    salesValue: b.salesValue,
  }));
}

export function buildChartBuckets(
  defects: Defect[],
  sales: Sale[],
  f: PeriodFilter
): ChartBucket[] {
  if (f.period === "yearly") {
    return buildYearlyBuckets(defects, sales, f.year);
  }

  if (f.period === "daily") {
    return buildHourlyBuckets(defects, sales, f.day);
  }

  if (f.period === "weekly") {
    const range = weekRange(f.weekEnd);
    if (!range) return [];
    const ranges: { label: string; start: string; end: string }[] = [];
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
      ranges.push({ label: dayLabel(d), start: d, end: d });
    }
    return buildRangeBuckets(defects, sales, ranges, monthOf(f.weekEnd));
  }

  if (f.period === "monthly") {
    const monthIdx = monthIndexOf(f.month);
    if (monthIdx < 0) return [];
    const y = Number(f.year) || new Date().getFullYear();
    const daysInMonth = new Date(Date.UTC(y, monthIdx + 1, 0)).getUTCDate();
    const from = `${y}-${pad2(monthIdx + 1)}-01`;
    const to = `${y}-${pad2(monthIdx + 1)}-${pad2(daysInMonth)}`;
    return buildRangeBuckets(
      defects,
      sales,
      buildDayRanges(from, to),
      f.month
    );
  }

  // custom (rentang tanggal)
  if (!f.from || !f.to) return [];
  return buildRangeBuckets(
    defects,
    sales,
    buildDayRanges(f.from, f.to),
    monthOf(f.to)
  );
}
