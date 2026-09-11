"use client";

import { useMemo, useState } from "react";
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
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { buildChartBuckets, type ChartBucket } from "@/lib/analytics";
import { formatDateTime, formatIDR, formatNumber, MONTHS } from "@/lib/format";
import type { PeriodFilter } from "@/lib/period";
import { useApi } from "@/lib/use-api";
import type {
  Defect,
  Factory,
  PeriodType,
  Problem,
  Product,
  Sale,
  Status,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SummaryCard } from "@/components/summary-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  Camera,
  Percent,
  ShoppingCart,
  Video,
  Wallet,
} from "lucide-react";

const compactIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 0,
});

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: ChartBucket }>;
  metric?: "qty" | "value";
}

function ratioClass(ratio: number | null): string {
  if (ratio === null) return "text-muted-foreground";
  const pct = ratio * 100;
  if (pct < 1)
    return "bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400";
  if (pct <= 2)
    return "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-400";
  return "bg-red-500/12 text-red-700 ring-red-500/30 dark:text-red-400";
}

function ratioTextClass(ratio: number | null): string {
  if (ratio === null) return "text-muted-foreground";
  const pct = ratio * 100;
  if (pct < 1) return "text-emerald-600 dark:text-emerald-400";
  if (pct <= 2) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function RatioBadge({ ratio }: { ratio: number | null }) {
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

const PIE_COLORS = [
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

interface PieSlice {
  name: string;
  value: number;
}

function buildPieData(
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

function PieLegend({
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

function ChartTooltip({
  active,
  label,
  payload,
  metric = "qty",
}: ChartTooltipProps) {
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
        <span>{format(defect)}</span>
      </div>
    </div>
  );
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  metric?: "qty" | "value";
}

function PieTooltip({ active, payload, metric = "qty" }: PieTooltipProps) {
  const { t } = useLanguage();
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const format = metric === "value" ? formatIDR : formatNumber;
  return (
    <div className="rounded-lg border bg-popover p-3 text-xs shadow-md">
      <div className="mb-1.5 font-medium">{item.name}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t("report.defect")}</span>
        <span>{format(Number(item.value ?? 0))}</span>
      </div>
    </div>
  );
}

type RecapSortKey =
  | "productName"
  | "defectQty"
  | "defectValue"
  | "salesQty"
  | "salesValue"
  | "ratio";

interface RecapRow {
  productId: number;
  productName: string;
  defectQty: number;
  defectValue?: number;
  salesQty: number;
  salesValue?: number;
  ratio: number | null;
}

interface ReportResponse {
  period: PeriodFilter;
  defects: Defect[];
  sales: Sale[];
  recap: RecapRow[];
  buckets: ChartBucket[];
  totals: {
    defectQty: number;
    defectValue?: number;
    salesQty: number;
    salesValue?: number;
  };
  years: number[];
  products: Product[];
  problems: Problem[];
  statuses: Status[];
  factories: Factory[];
}

export default function ReportPage() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  const [period, setPeriod] = useState<PeriodType>("yearly");
  const [month, setMonth] = useState<string>(MONTHS[0]);
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [day, setDay] = useState("2026-04-07");
  const [weekEnd, setWeekEnd] = useState("2026-04-07");
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2026-04-30");
  const [factoryId, setFactoryId] = useState<string>("all");

  const [recapSearch, setRecapSearch] = useState("");
  const [sortKey, setSortKey] = useState<RecapSortKey>("productName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [recapPageSize, setRecapPageSize] = useState(10);
  const [detailProductId, setDetailProductId] = useState<number | null>(null);
  const [detailPageState, setDetailPageState] = useState({
    signature: "",
    page: 1,
  });
  const detailSignature = String(detailProductId ?? "");
  const detailPage =
    detailPageState.signature === detailSignature ? detailPageState.page : 1;
  const setDetailPage = (next: number) =>
    setDetailPageState({ signature: detailSignature, page: next });
  const [detailPageSize, setDetailPageSize] = useState(10);

  const reportParams = new URLSearchParams({
    period,
    month,
    year,
    day,
    weekEnd,
    from,
    to,
  });
  if (isAdmin && factoryId !== "all") reportParams.set("factoryId", factoryId);
  const reportUrl = `/api/report?${reportParams.toString()}`;
  const { data: report, loading: reportLoading } =
    useApi<ReportResponse>(reportUrl);

  const buckets = report?.buckets ?? [];
  const products = report?.products ?? [];
  const problems = report?.problems ?? [];
  const statuses = report?.statuses ?? [];
  const factories = report?.factories ?? [];

  const yearOptions = useMemo(() => {
    const list = (report?.years ?? []).map((value) => String(value));
    if (year && !list.includes(year)) list.unshift(year);
    return list.map((value) => ({ value, label: value }));
  }, [report, year]);

  const visibleRecap = useMemo(() => {
    const recap = report?.recap ?? [];
    const q = recapSearch.trim().toLowerCase();
    const rows = q
      ? recap.filter((r) => r.productName.toLowerCase().includes(q))
      : recap;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "productName") {
        return a.productName.localeCompare(b.productName) * dir;
      }
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return (av - bv) * dir;
    });
  }, [report, recapSearch, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleRecap.length / recapPageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRecap = visibleRecap.slice(
    (currentPage - 1) * recapPageSize,
    currentPage * recapPageSize
  );

  const productPieQty = useMemo(() => {
    const rows = (report?.recap ?? []).map((row) => ({
      name: row.productName,
      value: row.defectQty,
    }));
    return buildPieData(rows, t("report.others"));
  }, [report, t]);

  const productPieValue = useMemo(() => {
    const rows = (report?.recap ?? []).map((row) => ({
      name: row.productName,
      value: row.defectValue ?? 0,
    }));
    return buildPieData(rows, t("report.others"));
  }, [report, t]);

  const detailProduct =
    detailProductId === null
      ? null
      : products.find((p) => p.id === detailProductId) ?? null;
  const detailDefects = useMemo(() => {
    const filteredDefects = report?.defects ?? [];
    return detailProductId === null
      ? []
      : filteredDefects.filter((d) => d.productId === detailProductId);
  }, [report, detailProductId]);

  const detailSales = useMemo(() => {
    const filteredSales = report?.sales ?? [];
    return detailProductId === null
      ? []
      : filteredSales.filter((s) => s.productId === detailProductId);
  }, [report, detailProductId]);

  const detailBuckets = useMemo(
    () =>
      buildChartBuckets(detailDefects, detailSales, {
        period,
        month,
        year,
        day,
        weekEnd,
        from,
        to,
      }),
    [detailDefects, detailSales, period, month, year, day, weekEnd, from, to]
  );

  const detailPieQty = useMemo(() => {
    const problems = report?.problems ?? [];
    const map = new Map<string, number>();
    for (const d of detailDefects) {
      const name = problems.find((p) => p.id === d.problemId)?.name ?? "-";
      map.set(name, (map.get(name) ?? 0) + d.quantity);
    }
    return buildPieData(
      Array.from(map.entries()).map(([name, value]) => ({ name, value })),
      t("report.others")
    );
  }, [detailDefects, report, t]);

  const detailPieValue = useMemo(() => {
    const problems = report?.problems ?? [];
    const map = new Map<string, number>();
    for (const d of detailDefects) {
      const name = problems.find((p) => p.id === d.problemId)?.name ?? "-";
      map.set(name, (map.get(name) ?? 0) + (d.value ?? 0));
    }
    return buildPieData(
      Array.from(map.entries()).map(([name, value]) => ({ name, value })),
      t("report.others")
    );
  }, [detailDefects, report, t]);

  const detailDefectQty = detailDefects.reduce((sum, d) => sum + d.quantity, 0);
  const detailDefectValue = detailDefects.reduce((sum, d) => sum + d.value, 0);

  const detailTotalPages = Math.max(
    1,
    Math.ceil(detailDefects.length / detailPageSize)
  );
  const detailCurrentPage = Math.min(detailPage, detailTotalPages);
  const pagedDetailDefects = detailDefects.slice(
    (detailCurrentPage - 1) * detailPageSize,
    detailCurrentPage * detailPageSize
  );

  function toggleSort(key: RecapSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortIcon(key: RecapSortKey) {
    if (sortKey !== key) return <ArrowUpDown className="size-3.5 opacity-50" />;
    return sortDir === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  }

  const dQty = report?.totals.defectQty ?? 0;
  const dVal = report?.totals.defectValue ?? 0;
  const sQty = report?.totals.salesQty ?? 0;
  const sVal = report?.totals.salesValue ?? 0;
  const ratioQty = sQty > 0 ? dQty / sQty : null;

  return (
    <div>
      <PageHeader
        title={t("report.title")}
        description={t("report.description")}
      />

      <Card size="sm" className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("report.period")}</Label>
            <Select value={period} onValueChange={(v) => setPeriod(String(v) as PeriodType)} items={[
              { value: "daily", label: t("report.daily") },
              { value: "weekly", label: t("report.weekly") },
              { value: "monthly", label: t("report.monthly") },
              { value: "yearly", label: t("report.yearly") },
              { value: "custom", label: t("report.custom") },
            ]}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("report.daily")}</SelectItem>
                <SelectItem value="weekly">{t("report.weekly")}</SelectItem>
                <SelectItem value="monthly">{t("report.monthly")}</SelectItem>
                <SelectItem value="yearly">{t("report.yearly")}</SelectItem>
                <SelectItem value="custom">{t("report.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === "monthly" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.month")}</Label>
                <Select value={month} onValueChange={(v) => setMonth(String(v))} items={[
                  ...MONTHS.map((m) => ({ value: m, label: m })),
                ]}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("report.year")}</Label>
                <Select value={year} onValueChange={(v) => setYear(String(v))} items={yearOptions}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {period === "yearly" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("report.year")}</Label>
              <Select value={year} onValueChange={(v) => setYear(String(v))} items={yearOptions}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {period === "daily" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("report.date")}</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          )}

          {period === "weekly" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("report.weekEnd")}</Label>
              <Input
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
              />
            </div>
          )}

          {period === "custom" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("report.from")}</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("report.to")}</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}

          {isAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.factory")}</Label>
              <Select value={factoryId} onValueChange={(v) => setFactoryId(String(v))} items={[
                { value: "all", label: t("header.allFactories") },
                ...factories.map((f) => ({
                  value: String(f.id),
                  label: f.name,
                })),
              ]}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("header.allFactories")}</SelectItem>
                  {factories.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryCard
          title={t("report.totalDefect")}
          value={formatNumber(dQty)}
          description={t("common.quantity")}
          icon={AlertTriangle}
        />
        <SummaryCard
          title={t("report.totalSales")}
          value={formatNumber(sQty)}
          description={t("common.quantity")}
          icon={ShoppingCart}
        />
        {isAdmin && (
          <SummaryCard
            title={t("report.defectValue")}
            value={formatIDR(dVal)}
            description={t("common.valueIdr")}
            icon={Wallet}
          />
        )}
        {isAdmin && (
          <SummaryCard
            title={t("report.salesValue")}
            value={formatIDR(sVal)}
            description={t("common.valueIdr")}
            icon={Banknote}
          />
        )}
        <SummaryCard
          title={t("report.ratio")}
          value={
            ratioQty === null ? (
              "-"
            ) : (
              <span className={ratioTextClass(ratioQty)}>
                {(ratioQty * 100).toFixed(2)}%
              </span>
            )
          }
          description={t("report.ratioDesc")}
          icon={Percent}
        />
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("report.chartQtyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("report.trendTitle")}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={buckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={70}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis />
                    <Tooltip content={<ChartTooltip metric="qty" />} />
                    <Bar
                      dataKey="defectQty"
                      name={t("report.defect")}
                      fill="var(--chart-4)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("report.pieProductTitle")}
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-[240px] min-w-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={productPieQty}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={renderPieLabel}
                          labelLine={false}
                        >
                          {productPieQty.map((entry, index) => (
                            <Cell
                              key={`${entry.name}-${index}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip metric="qty" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="max-w-[50%] shrink-0">
                    <PieLegend data={productPieQty} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t("report.chartValueTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    {t("report.trendTitle")}
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={buckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        height={70}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        tickFormatter={(v) => compactIDR.format(Number(v))}
                      />
                      <Tooltip content={<ChartTooltip metric="value" />} />
                      <Bar
                        dataKey="defectValue"
                        name={t("report.defect")}
                        fill="var(--chart-4)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    {t("report.pieProductTitle")}
                  </div>
                <div className="flex items-center gap-3">
                  <div className="h-[240px] min-w-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={productPieValue}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={renderPieLabel}
                          labelLine={false}
                        >
                          {productPieValue.map((entry, index) => (
                            <Cell
                              key={`${entry.name}-${index}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip metric="value" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="max-w-[50%] shrink-0">
                    <PieLegend data={productPieValue} />
                  </div>
                </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card size="sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{t("report.recapTitle")}</CardTitle>
          <Input
            value={recapSearch}
            onChange={(e) => {
              setRecapSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("report.searchProduct")}
            className="w-56"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("productName")}
                  >
                    {t("common.product")} {sortIcon("productName")}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("defectQty")}
                  >
                    {t("report.qtyDefect")} {sortIcon("defectQty")}
                  </button>
                </TableHead>
                {isAdmin && (
                  <TableHead className="text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("defectValue")}
                    >
                      {t("report.valueDefect")} {sortIcon("defectValue")}
                    </button>
                  </TableHead>
                )}
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("salesQty")}
                  >
                    {t("report.qtySales")} {sortIcon("salesQty")}
                  </button>
                </TableHead>
                {isAdmin && (
                  <TableHead className="text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort("salesValue")}
                    >
                      {t("report.valueSales")} {sortIcon("salesValue")}
                    </button>
                  </TableHead>
                )}
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("ratio")}
                  >
                    {t("report.ratio")} {sortIcon("ratio")}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRecap.map((row) => (
                <TableRow
                  key={row.productId}
                  className="cursor-pointer"
                  onClick={() => {
                    setDetailProductId(row.productId);
                    setDetailPageState({
                      signature: String(row.productId),
                      page: 1,
                    });
                  }}
                >
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(row.defectQty)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {formatIDR(row.defectValue ?? 0)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {formatNumber(row.salesQty)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {formatIDR(row.salesValue ?? 0)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <RatioBadge ratio={row.ratio} />
                  </TableCell>
                </TableRow>
              ))}
              {pagedRecap.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 6 : 4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {reportLoading ? t("common.loading") : t("common.noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {visibleRecap.length > 0 && (
            <div className="mt-4">
              <Pagination
                totalItems={visibleRecap.length}
                page={currentPage}
                pageSize={recapPageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setRecapPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={detailProductId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailProductId(null);
        }}
      >
        <DialogContent className="sm:max-w-7xl">
          <DialogHeader>
            <DialogTitle>
              {t("report.detailTitle", {
                product: detailProduct?.name ?? "-",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("report.detailDesc", { count: detailDefects.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[78vh] grid-cols-1 gap-5 overflow-y-auto lg:grid-cols-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">
                  {t("report.totalQtyDefect")}
                </div>
                <div className="text-lg font-semibold">
                  {formatNumber(detailDefectQty)}
                </div>
              </div>
              {isAdmin && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">
                    {t("report.totalValueDefect")}
                  </div>
                  <div className="text-lg font-semibold">
                    {formatIDR(detailDefectValue)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5 lg:col-start-1">
              <div>
                <div className="mb-2 text-sm font-medium">
                  {t("report.chartQtyTitle")}
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      {t("report.trendTitle")}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={detailBuckets}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="label"
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={55}
                          tick={{ fontSize: 9 }}
                        />
                        <YAxis />
                        <Tooltip content={<ChartTooltip metric="qty" />} />
                        <Bar
                          dataKey="defectQty"
                          name={t("report.defect")}
                          fill="var(--chart-4)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      {t("report.pieProblemTitle")}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-[180px] min-w-0 flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={detailPieQty}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={55}
                              label={renderPieLabel}
                              labelLine={false}
                            >
                              {detailPieQty.map((entry, index) => (
                                <Cell
                                  key={`${entry.name}-${index}`}
                                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<PieTooltip metric="qty" />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="max-w-[50%] shrink-0">
                        <PieLegend data={detailPieQty} maxLen={16} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div>
                  <div className="mb-2 text-sm font-medium">
                    {t("report.chartValueTitle")}
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("report.trendTitle")}
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={detailBuckets}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="label"
                            interval={0}
                            angle={-35}
                            textAnchor="end"
                            height={55}
                            tick={{ fontSize: 9 }}
                          />
                          <YAxis
                            tickFormatter={(v) => compactIDR.format(Number(v))}
                          />
                          <Tooltip content={<ChartTooltip metric="value" />} />
                          <Bar
                            dataKey="defectValue"
                            name={t("report.defect")}
                            fill="var(--chart-4)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("report.pieProblemTitle")}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-[180px] min-w-0 flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={detailPieValue}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={55}
                                label={renderPieLabel}
                                labelLine={false}
                              >
                                {detailPieValue.map((entry, index) => (
                                  <Cell
                                    key={`${entry.name}-${index}`}
                                    fill={
                                      PIE_COLORS[index % PIE_COLORS.length]
                                    }
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                content={<PieTooltip metric="value" />}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="max-w-[50%] shrink-0">
                          <PieLegend data={detailPieValue} maxLen={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.codeGaransi")}</TableHead>
                  <TableHead>{t("common.timestamp")}</TableHead>
                  <TableHead>{t("common.problem")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.qty")}
                  </TableHead>
                  {isAdmin && (
                    <TableHead className="text-right">
                      {t("common.value")}
                    </TableHead>
                  )}
                  <TableHead>{t("common.media")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDetailDefects.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">
                      {d.codeGaransi}
                    </TableCell>
                    <TableCell>{formatDateTime(d.timestamp)}</TableCell>
                    <TableCell>
                      {problems.find((p) => p.id === d.problemId)?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {statuses.find((s) => s.id === d.statusId)?.name ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(d.quantity)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {formatIDR(d.value)}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-1">
                        {d.photosLink && (
                          <a
                            href={d.photosLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Camera className="size-4" />
                          </a>
                        )}
                        {d.videosLink && (
                          <a
                            href={d.videosLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Video className="size-4" />
                          </a>
                        )}
                        {!d.photosLink && !d.videosLink && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {detailDefects.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 7 : 6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {t("report.noDefectData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {detailDefects.length > 0 && (
              <div className="mt-3">
                <Pagination
                  totalItems={detailDefects.length}
                  page={detailCurrentPage}
                  pageSize={detailPageSize}
                  onPageChange={setDetailPage}
                  onPageSizeChange={(size) => {
                    setDetailPageSize(size);
                    setDetailPage(1);
                  }}
                />
              </div>
            )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
