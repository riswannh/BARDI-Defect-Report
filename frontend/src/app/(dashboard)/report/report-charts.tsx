"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartBucket } from "@/lib/analytics";
import { formatIDR, formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Potongan grafik halaman Report.
 *
 * Empat kartu grafik di halaman itu strukturnya sama (grafik batang + pie
 * proporsi) dan hanya berbeda data, metrik (qty/value), serta judulnya —
 * sebelumnya keempatnya ditulis ulang hampir blok per blok. Komponen di sini
 * menyatukan pola tersebut supaya perbaikan hanya perlu dilakukan sekali.
 */

const compactIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 0,
});

function ratioClass(ratio: number | null): string {
  if (ratio === null) return "text-muted-foreground";
  const pct = ratio * 100;
  if (pct < 1)
    return "bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400";
  if (pct <= 2)
    return "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-400";
  return "bg-red-500/12 text-red-700 ring-red-500/30 dark:text-red-400";
}

export function ratioTextClass(ratio: number | null): string {
  if (ratio === null) return "text-muted-foreground";
  const pct = ratio * 100;
  if (pct < 1) return "text-emerald-600 dark:text-emerald-400";
  if (pct <= 2) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function RatioBadge({ ratio }: { ratio: number | null }) {
  if (ratio === null) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 tabular-nums ${ratioClass(
        ratio
      )}`}
    >
      {(ratio * 100).toFixed(2)}%
    </span>
  );
}

export const PIE_COLORS = [
  "oklch(0.648 0.1 209.8)",
  "oklch(0.731 0.104 203.2)",
  "oklch(0.816 0.084 204.3)",
  "oklch(0.76 0.15 82)",
  "oklch(0.637 0.19 25)",
  "oklch(0.62 0.15 295)",
  "oklch(0.7 0.14 150)",
  "oklch(0.68 0.12 250)",
  "oklch(0.72 0.13 330)",
  "oklch(0.65 0.1 180)",
];

export interface PieSlice {
  name: string;
  value: number;
}

/** Top N irisan + "Lainnya" agar pie tetap terbaca. */
export function buildPieData(
  rows: PieSlice[],
  othersLabel: string,
  maxSlices = 7
): PieSlice[] {
  const sorted = rows
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= maxSlices) return sorted;
  const top = sorted.slice(0, maxSlices);
  const rest = sorted
    .slice(maxSlices)
    .reduce((sum, row) => sum + row.value, 0);
  return [...top, { name: othersLabel, value: rest }];
}

/** Kelompokkan nilai per nama (dipakai pie problem pada dialog detail). */
export function sumByKey(entries: Array<{ name: string; value: number }>): PieSlice[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.name, (map.get(entry.name) ?? 0) + entry.value);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function renderPieLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    percent = 0,
  } = props;
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      stroke="rgba(0,0,0,0.45)"
      strokeWidth={2.5}
      paintOrder="stroke"
      strokeLinejoin="round"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

export function PieLegend({
  data,
  maxLen = 22,
}: {
  data: PieSlice[];
  maxLen?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex flex-col items-start gap-1 text-[11px] leading-4">
      {data.map((item, index) => (
        <div key={`${item.name}-${index}`} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
          />
          <span className="shrink-0" title={item.name}>
            {item.name.length > maxLen
              ? `${item.name.slice(0, maxLen - 1)}…`
              : item.name}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

type Metric = "qty" | "value";

function ChartTooltip({
  active,
  label,
  payload,
  metric = "qty",
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: ChartBucket }>;
  metric?: Metric;
}) {
  const { t } = useLanguage();
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0].payload;
  const isValue = metric === "value";
  const defect = isValue ? bucket.defectValue : bucket.defectQty;
  const format = isValue ? formatIDR : formatNumber;
  return (
    <div className="rounded-lg border bg-popover p-3 text-xs shadow-md">
      <div className="mb-1.5 font-medium">{label}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t("report.defect")}</span>
        <span className="tabular-nums">{format(defect)}</span>
      </div>
    </div>
  );
}

function SalesTooltip({
  active,
  label,
  payload,
  metric = "qty",
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: ChartBucket }>;
  metric?: Metric;
}) {
  const { t } = useLanguage();
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0].payload;
  const isValue = metric === "value";
  const value = isValue ? bucket.salesValue : bucket.salesQty;
  const format = isValue ? formatIDR : formatNumber;
  return (
    <div className="rounded-lg border bg-popover p-3 text-xs shadow-md">
      <div className="mb-1.5 font-medium">{label}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t("report.sales")}</span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
    </div>
  );
}

function PieTooltip({
  active,
  payload,
  metric = "qty",
  kind = "defect",
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  metric?: Metric;
  kind?: "defect" | "sales";
}) {
  const { t } = useLanguage();
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const format = metric === "value" ? formatIDR : formatNumber;
  return (
    <div className="rounded-lg border bg-popover p-3 text-xs shadow-md">
      <div className="mb-1.5 font-medium">{item.name}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">
          {kind === "sales" ? t("report.sales") : t("report.defect")}
        </span>
        <span className="tabular-nums">{format(Number(item.value ?? 0))}</span>
      </div>
    </div>
  );
}

/** Grafik batang defect (buckets) atau sales tahunan. */
export function MetricBarChart({
  data,
  metric,
  kind,
  height = 240,
  rotateLabels = false,
}: {
  data: ChartBucket[];
  metric: Metric;
  kind: "defect" | "sales";
  height?: number;
  rotateLabels?: boolean;
}) {
  const { t } = useLanguage();
  const dataKey =
    kind === "sales"
      ? metric === "value"
        ? "salesValue"
        : "salesQty"
      : metric === "value"
        ? "defectValue"
        : "defectQty";
  // Grafik kecil (mis. di dalam dialog detail) memakai label yang lebih rapat.
  const compact = height <= 210;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          interval={0}
          tick={{ fontSize: compact ? 9 : 10 }}
          {...(rotateLabels
            ? { angle: -35, textAnchor: "end" as const, height: compact ? 55 : 70 }
            : {})}
        />
        <YAxis
          tickFormatter={
            metric === "value" ? (v) => compactIDR.format(Number(v)) : undefined
          }
        />
        <Tooltip
          content={
            kind === "sales" ? (
              <SalesTooltip metric={metric} />
            ) : (
              <ChartTooltip metric={metric} />
            )
          }
        />
        <Bar
          dataKey={dataKey}
          name={kind === "sales" ? t("report.sales") : t("report.defect")}
          fill={kind === "sales" ? "var(--chart-2)" : "var(--chart-4)"}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Pie proporsi + legend sebagai satu kesatuan tata letak. */
export function PieWithLegend({
  data,
  metric,
  kind,
  height = 240,
  outerRadius = 70,
  legendMaxLen = 22,
  title,
}: {
  data: PieSlice[];
  metric: Metric;
  kind: "defect" | "sales";
  height?: number;
  outerRadius?: number;
  legendMaxLen?: number;
  title?: string;
}) {
  return (
    <div>
      {title && (
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {title}
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={outerRadius}
                label={renderPieLabel}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip metric={metric} kind={kind} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="max-w-[50%] shrink-0">
          <PieLegend data={data} maxLen={legendMaxLen} />
        </div>
      </div>
    </div>
  );
}

/** Kartu grafik: batang tren di kiri, pie proporsi di kanan. */
export function ChartPairCard({
  title,
  bar,
  pie,
  footer,
}: {
  title: string;
  bar: ReactNode;
  pie: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>{bar}</div>
          <div>{pie}</div>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
