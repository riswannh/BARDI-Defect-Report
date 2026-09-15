"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { formatIDR, formatNumber, MONTHS } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Factory, PeriodType } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SummaryCard } from "@/components/summary-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Package,
  Percent,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import {
  ChartPairCard,
  MetricBarChart,
  PieWithLegend,
  RatioBadge,
  buildPieData,
  ratioTextClass,
} from "./report-charts";
import {
  defectSalesRatio,
  sortRecap,
  type RecapSortKey,
  type ReportResponse,
} from "./report-data";
import { ProductDetailDialog } from "./product-detail-dialog";

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
  const [sortKey, setSortKey] = useState<RecapSortKey>("defectQty");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [recapPageSize, setRecapPageSize] = useState(10);
  const [detailProductId, setDetailProductId] = useState<number | null>(null);

  // Ringkasan rekap, grafik, dan total dihitung di server (GET /api/report).
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
  const { data: report, loading: reportLoading } = useApi<ReportResponse>(
    `/api/report?${reportParams.toString()}`
  );

  // Daftar pabrik diambil dari endpoint master, bukan dari respons report:
  // `useApi` mengosongkan data saat URL berubah, dan daftar ini harus stabil
  // supaya dropdown pabrik tidak berkedip kosong tiap periode berganti.
  const { data: factoryData } = useApi<Factory[]>(
    isAdmin ? "/api/factories" : null
  );
  const factories = factoryData ?? [];

  const yearOptions = useMemo(() => {
    const list = (report?.years ?? []).map((value) => String(value));
    if (year && !list.includes(year)) list.unshift(year);
    return list.map((value) => ({ value, label: value }));
  }, [report, year]);

  const visibleRecap = useMemo(
    () => sortRecap(report?.recap ?? [], recapSearch, sortKey, sortDir),
    [report, recapSearch, sortKey, sortDir]
  );
  const totalPages = Math.max(1, Math.ceil(visibleRecap.length / recapPageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRecap = visibleRecap.slice(
    (currentPage - 1) * recapPageSize,
    currentPage * recapPageSize
  );

  const { productPieQty, productPieValue, salesPieQty, salesPieValue } =
    useMemo(() => {
      const others = t("report.others");
      const recap = report?.recap ?? [];
      // Grafik sales selalu tahunan, jadi pie-nya memakai rekap tahunan.
      const yearly = report?.salesYearlyRecap ?? [];
      return {
        productPieQty: buildPieData(
          recap.map((row) => ({ name: row.productName, value: row.defectQty })),
          others
        ),
        productPieValue: buildPieData(
          recap.map((row) => ({
            name: row.productName,
            value: row.defectValue ?? 0,
          })),
          others
        ),
        salesPieQty: buildPieData(
          yearly.map((row) => ({ name: row.productName, value: row.salesQty })),
          others
        ),
        salesPieValue: buildPieData(
          yearly.map((row) => ({
            name: row.productName,
            value: row.salesValue ?? 0,
          })),
          others
        ),
      };
    }, [report, t]);

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
  /**
   * Kartu Total Defect & Nilai Defect menampilkan angka BERSIH: defect dikurangi
   * Replacement (qty, dan Value RW yang sama-sama Rupiah). Angka mentah tetap
   * dipakai grafik, pie, dan tabel rekap di bawahnya — dan ditampilkan di
   * keterangan kartu supaya terlihat bahwa ada pengurangan.
   */
  const netDQty = report?.totals.netDefectQty ?? 0;
  const netDVal = report?.totals.netDefectValue ?? 0;
  const sQty = report?.totals.salesQty ?? 0;
  const sVal = report?.totals.salesValue ?? 0;
  // Rasio memakai angka bersih supaya konsisten dengan kartu Total Defect.
  const ratioQty = defectSalesRatio(netDQty, sQty);
  // PO berketerangan "Replacement" pada periode terpilih (dihitung di server).
  const replacementQty = report?.totals.replacementQty ?? 0;

  const buckets = report?.buckets ?? [];
  const salesYearly = report?.salesYearly ?? [];

  const trendLabel = (
    <div className="mb-2 text-xs font-medium text-muted-foreground">
      {t("report.trendTitle")}
    </div>
  );

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
            <Select
              value={period}
              onValueChange={(v) => setPeriod(String(v) as PeriodType)}
              items={[
                { value: "daily", label: t("report.daily") },
                { value: "weekly", label: t("report.weekly") },
                { value: "monthly", label: t("report.monthly") },
                { value: "yearly", label: t("report.yearly") },
                { value: "custom", label: t("report.custom") },
              ]}
            >
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
                <Select
                  value={month}
                  onValueChange={(v) => setMonth(String(v))}
                  items={MONTHS.map((m) => ({ value: m, label: m }))}
                >
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
                <Select
                  value={year}
                  onValueChange={(v) => setYear(String(v))}
                  items={yearOptions}
                >
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
              <Select
                value={year}
                onValueChange={(v) => setYear(String(v))}
                items={yearOptions}
              >
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
              <Input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
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
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("report.to")}</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </>
          )}

          {isAdmin && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.factory")}</Label>
              <Select
                value={factoryId}
                onValueChange={(v) => setFactoryId(String(v))}
                items={[
                  { value: "all", label: t("header.allFactories") },
                  ...factories.map((f) => ({
                    value: String(f.id),
                    label: f.name,
                  })),
                ]}
              >
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          title={t("report.totalDefect")}
          value={formatNumber(netDQty)}
          description={t("report.totalDefectNet", {
            count: formatNumber(dQty),
            replacement: formatNumber(replacementQty),
          })}
          icon={AlertTriangle}
        />
        {isAdmin && (
          <SummaryCard
            title={t("report.defectValue")}
            value={formatIDR(netDVal)}
            description={t("report.defectValueNet", {
              count: formatIDR(dVal),
              replacement: formatIDR(
                report?.totals.replacementRwValue ?? 0
              ),
            })}
            icon={Wallet}
          />
        )}
        <SummaryCard
          title={t("report.totalSales")}
          value={formatNumber(sQty)}
          description={t("common.quantity")}
          icon={ShoppingCart}
        />
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
        {/* Diambil dari PO Product berketerangan "Replacement", mengikuti
            periode yang sedang dipilih. */}
        <SummaryCard
          title={t("report.replacement")}
          value={formatNumber(replacementQty)}
          description={t("report.replacementDesc")}
          icon={Package}
        />
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <ChartPairCard
          title={t("report.chartQtyTitle")}
          bar={
            <>
              {trendLabel}
              <MetricBarChart
                data={buckets}
                metric="qty"
                kind="defect"
                rotateLabels
              />
            </>
          }
          pie={
            <PieWithLegend
              data={productPieQty}
              metric="qty"
              kind="defect"
              title={t("report.pieProductTitle")}
            />
          }
        />

        {isAdmin && (
          <ChartPairCard
            title={t("report.chartValueTitle")}
            bar={
              <>
                {trendLabel}
                <MetricBarChart
                  data={buckets}
                  metric="value"
                  kind="defect"
                  rotateLabels
                />
              </>
            }
            pie={
              <PieWithLegend
                data={productPieValue}
                metric="value"
                kind="defect"
                title={t("report.pieProductTitle")}
              />
            }
          />
        )}

        {/* Grafik sales selalu tahunan (12 bulan), terlepas dari periode terpilih. */}
        <ChartPairCard
          title={t("report.chartSalesQtyTitle")}
          bar={
            <>
              {trendLabel}
              <MetricBarChart data={salesYearly} metric="qty" kind="sales" />
            </>
          }
          pie={
            <PieWithLegend
              data={salesPieQty}
              metric="qty"
              kind="sales"
              title={t("report.pieSalesProductTitle")}
            />
          }
        />

        {isAdmin && (
          <ChartPairCard
            title={t("report.chartSalesValueTitle")}
            bar={
              <>
                {trendLabel}
                <MetricBarChart
                  data={salesYearly}
                  metric="value"
                  kind="sales"
                />
              </>
            }
            pie={
              <PieWithLegend
                data={salesPieValue}
                metric="value"
                kind="sales"
                title={t("report.pieSalesProductTitle")}
              />
            }
          />
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
                  }}
                >
                  <TableCell className="font-medium">
                    {row.productName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.defectQty)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right tabular-nums">
                      {formatIDR(row.defectValue ?? 0)}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.salesQty)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right tabular-nums">
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

      <ProductDetailDialog
        report={report}
        productId={detailProductId}
        isAdmin={isAdmin}
        onOpenChange={(open) => {
          if (!open) setDetailProductId(null);
        }}
      />
    </div>
  );
}
