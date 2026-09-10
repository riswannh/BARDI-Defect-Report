"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import {
  buildChartBuckets,
  summarizeByProduct,
  totalDefectQty,
  totalDefectValue,
  totalSalesQty,
  totalSalesValue,
  type ChartBucket,
} from "@/lib/analytics";
import { formatDateTime, formatIDR, formatNumber, MONTHS } from "@/lib/format";
import {
  matchesDefectPeriod,
  matchesSalePeriod,
  type PeriodFilter,
} from "@/lib/period";
import { defects as allDefects, factories, factoryOptions, problems, products, sales as allSales, statuses } from "@/lib/mock-data";
import type { PeriodType } from "@/lib/types";
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
  const sales = isValue ? bucket.salesValue : bucket.salesQty;
  const ratio = sales > 0 ? defect / sales : null;
  const format = isValue ? formatIDR : formatNumber;
  return (
    <div className="rounded-lg border bg-popover p-3 text-xs shadow-md">
      <div className="mb-1.5 font-medium">{label}</div>
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t("report.defect")}</span>
          <span>{format(defect)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t("report.sales")}</span>
          <span>{format(sales)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t("report.ratio")}</span>
          <span>{ratio === null ? "-" : `${(ratio * 100).toFixed(2)}%`}</span>
        </div>
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

export default function ReportPage() {
  const { isAdmin, user } = useAuth();
  const { t } = useLanguage();

  const [period, setPeriod] = useState<PeriodType>("monthly");
  const [month, setMonth] = useState<string>("all");
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

  const filtered = useMemo(() => {
    const f: PeriodFilter = { period, month, day, weekEnd, from, to };
    const factoryFilter = (factoryIdValue: number) =>
      user?.isAdmin
        ? factoryId === "all" || factoryId === String(factoryIdValue)
        : user?.factoryId === factoryIdValue;

    const defects = allDefects.filter(
      (d) =>
        factoryFilter(d.factoryId) && matchesDefectPeriod(d.timestamp, f)
    );
    const sales = allSales.filter(
      (s) => factoryFilter(s.factoryId) && matchesSalePeriod(s.month, f)
    );

    return { defects, sales };
  }, [period, month, day, weekEnd, from, to, factoryId, user]);

  const buckets = useMemo(
    () =>
      buildChartBuckets(filtered.defects, filtered.sales, {
        period,
        month,
        day,
        weekEnd,
        from,
        to,
      }),
    [filtered, period, month, day, weekEnd, from, to]
  );
  const recap = useMemo(
    () => summarizeByProduct(filtered.defects, filtered.sales, products),
    [filtered]
  );

  const visibleRecap = useMemo(() => {
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
  }, [recap, recapSearch, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleRecap.length / recapPageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRecap = visibleRecap.slice(
    (currentPage - 1) * recapPageSize,
    currentPage * recapPageSize
  );

  const detailProduct =
    detailProductId === null
      ? null
      : products.find((p) => p.id === detailProductId) ?? null;
  const detailDefects = useMemo(
    () =>
      detailProductId === null
        ? []
        : filtered.defects.filter((d) => d.productId === detailProductId),
    [filtered.defects, detailProductId]
  );

  const detailSales = useMemo(
    () =>
      detailProductId === null
        ? []
        : filtered.sales.filter((s) => s.productId === detailProductId),
    [filtered.sales, detailProductId]
  );

  const detailBuckets = useMemo(
    () =>
      buildChartBuckets(detailDefects, detailSales, {
        period,
        month,
        day,
        weekEnd,
        from,
        to,
      }),
    [detailDefects, detailSales, period, month, day, weekEnd, from, to]
  );

  const detailDefectQty = detailDefects.reduce((sum, d) => sum + d.quantity, 0);
  const detailDefectValue = detailDefects.reduce((sum, d) => sum + d.value, 0);

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

  const dQty = totalDefectQty(filtered.defects);
  const dVal = totalDefectValue(filtered.defects);
  const sQty = totalSalesQty(filtered.sales);
  const sVal = totalSalesValue(filtered.sales);

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
              { value: "custom", label: t("report.custom") },
            ]}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("report.daily")}</SelectItem>
                <SelectItem value="weekly">{t("report.weekly")}</SelectItem>
                <SelectItem value="monthly">{t("report.monthly")}</SelectItem>
                <SelectItem value="custom">{t("report.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === "monthly" && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.month")}</Label>
              <Select value={month} onValueChange={(v) => setMonth(String(v))} items={[
                { value: "all", label: t("report.allMonths") },
                ...MONTHS.map((m) => ({ value: m, label: m })),
              ]}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("report.allMonths")}</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
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
                ...factoryOptions,
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("report.chartQtyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={buckets}>
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
                <Legend />
                <Bar
                  dataKey="defectQty"
                  name={t("report.defect")}
                  fill="var(--chart-4)"
                />
                <Line
                  type="monotone"
                  dataKey="salesQty"
                  name={t("report.sales")}
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t("report.chartValueTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={buckets}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tickFormatter={(v) => compactIDR.format(Number(v))} />
                  <Tooltip content={<ChartTooltip metric="value" />} />
                  <Legend />
                  <Bar
                    dataKey="defectValue"
                    name={t("report.defect")}
                    fill="var(--chart-4)"
                  />
                  <Line
                    type="monotone"
                    dataKey="salesValue"
                    name={t("report.sales")}
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
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
                  onClick={() => setDetailProductId(row.productId)}
                >
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(row.defectQty)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {formatIDR(row.defectValue)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {formatNumber(row.salesQty)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {formatIDR(row.salesValue)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {row.ratio === null
                      ? "-"
                      : `${(row.ratio * 100).toFixed(2)}%`}
                  </TableCell>
                </TableRow>
              ))}
              {pagedRecap.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 6 : 4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t("common.noData")}
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
        <DialogContent className="sm:max-w-3xl">
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
          <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
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

            <div
              className={
                isAdmin
                  ? "grid grid-cols-1 gap-4 lg:grid-cols-2"
                  : "grid grid-cols-1 gap-4"
              }
            >
              <div>
                <div className="mb-2 text-sm font-medium">
                  {t("report.chartQtyTitle")}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={detailBuckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 9 }}
                    />
                    <YAxis />
                    <Tooltip content={<ChartTooltip metric="qty" />} />
                    <Legend />
                    <Bar
                      dataKey="defectQty"
                      name={t("report.defect")}
                      fill="var(--chart-4)"
                    />
                    <Line
                      type="monotone"
                      dataKey="salesQty"
                      name={t("report.sales")}
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {isAdmin && (
                <div>
                  <div className="mb-2 text-sm font-medium">
                    {t("report.chartValueTitle")}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={detailBuckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 9 }}
                      />
                      <YAxis
                        tickFormatter={(v) => compactIDR.format(Number(v))}
                      />
                      <Tooltip content={<ChartTooltip metric="value" />} />
                      <Legend />
                      <Bar
                        dataKey="defectValue"
                        name={t("report.defect")}
                        fill="var(--chart-4)"
                      />
                      <Line
                        type="monotone"
                        dataKey="salesValue"
                        name={t("report.sales")}
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

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
                {detailDefects.map((d) => (
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
