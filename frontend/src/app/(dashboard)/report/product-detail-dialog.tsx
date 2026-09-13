"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { buildChartBuckets } from "@/lib/analytics";
import { formatDateTime, formatIDR, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Camera, Video } from "lucide-react";
import {
  MetricBarChart,
  PieWithLegend,
  buildPieData,
  sumByKey,
} from "./report-charts";
import type { ReportResponse } from "./report-data";

/**
 * Dialog detail per produk: ringkasan, grafik defect (batang + pie per problem),
 * grafik nilai khusus admin, dan tabel defect produk tersebut.
 *
 * Datanya dihitung di sini dari respons `/api/report` supaya halaman tidak perlu
 * menampung seluruh state turunan dialog ini.
 */
export function ProductDetailDialog({
  report,
  productId,
  isAdmin,
  onOpenChange,
}: {
  report: ReportResponse | null;
  productId: number | null;
  isAdmin: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const [pageState, setPageState] = useState({ signature: "", page: 1 });
  const [pageSize, setPageSize] = useState(10);

  const signature = String(productId ?? "");
  const page = pageState.signature === signature ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ signature, page: next });

  const products = report?.products ?? [];
  // `?? []` menghasilkan array baru tiap render, dan itu membuat useMemo di
  // bawah selalu dianggap usang. Array tetap dipakai supaya memo benar-benar
  // hanya dihitung ulang saat datanya berubah.
  const problems = useMemo(() => report?.problems ?? [], [report]);
  const statuses = report?.statuses ?? [];
  const product =
    productId === null ? null : products.find((p) => p.id === productId) ?? null;

  const defects = useMemo(() => {
    if (productId === null) return [];
    return (report?.defects ?? []).filter((d) => d.productId === productId);
  }, [report, productId]);

  const sales = useMemo(() => {
    if (productId === null) return [];
    return (report?.sales ?? []).filter((s) => s.productId === productId);
  }, [report, productId]);

  const buckets = useMemo(() => {
    // Respons `/api/report` membawa periode yang sudah dipakai server, jadi
    // bucket detail memakai periode yang sama persis dengan grafik utama.
    if (!report) return [];
    return buildChartBuckets(defects, sales, report.period);
  }, [defects, sales, report]);

  // Pie per problem: defect tidak menyimpan nama problem, hanya id-nya.
  const pieQty = useMemo(() => {
    const rows = defects.map((d) => ({
      name: problems.find((p) => p.id === d.problemId)?.name ?? "-",
      value: d.quantity,
    }));
    return buildPieData(sumByKey(rows), t("report.others"));
  }, [defects, problems, t]);

  const pieValue = useMemo(() => {
    const rows = defects.map((d) => ({
      name: problems.find((p) => p.id === d.problemId)?.name ?? "-",
      value: d.value ?? 0,
    }));
    return buildPieData(sumByKey(rows), t("report.others"));
  }, [defects, problems, t]);

  const totalQty = defects.reduce((sum, d) => sum + d.quantity, 0);
  const totalValue = defects.reduce((sum, d) => sum + (d.value ?? 0), 0);

  const totalPages = Math.max(1, Math.ceil(defects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedDefects = defects.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <Dialog
      open={productId !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>
            {t("report.detailTitle", { product: product?.name ?? "-" })}
          </DialogTitle>
          <DialogDescription>
            {t("report.detailDesc", { count: defects.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[78vh] grid-cols-1 gap-5 overflow-y-auto lg:grid-cols-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">
                {t("report.totalQtyDefect")}
              </div>
              <div className="text-lg font-semibold tabular-nums">
                {formatNumber(totalQty)}
              </div>
            </div>
            {isAdmin && (
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">
                  {t("report.totalValueDefect")}
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatIDR(totalValue)}
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
                  <MetricBarChart
                    data={buckets}
                    metric="qty"
                    kind="defect"
                    height={200}
                    rotateLabels
                  />
                </div>
                <PieWithLegend
                  data={pieQty}
                  metric="qty"
                  kind="defect"
                  height={180}
                  outerRadius={55}
                  legendMaxLen={16}
                  title={t("report.pieProblemTitle")}
                />
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
                    <MetricBarChart
                      data={buckets}
                      metric="value"
                      kind="defect"
                      height={200}
                      rotateLabels
                    />
                  </div>
                  <PieWithLegend
                    data={pieValue}
                    metric="value"
                    kind="defect"
                    height={180}
                    outerRadius={55}
                    legendMaxLen={16}
                    title={t("report.pieProblemTitle")}
                  />
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
                  <TableHead className="text-right">{t("common.qty")}</TableHead>
                  {isAdmin && (
                    <TableHead className="text-right">
                      {t("common.value")}
                    </TableHead>
                  )}
                  <TableHead>{t("common.media")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedDefects.map((d) => (
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
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(d.quantity)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right tabular-nums">
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
                {defects.length === 0 && (
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
            {defects.length > 0 && (
              <div className="mt-3">
                <Pagination
                  totalItems={defects.length}
                  page={currentPage}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
