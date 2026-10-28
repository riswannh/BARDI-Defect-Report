"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Boxes, Eye, Loader2, PackageCheck, RefreshCw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SummaryCard } from "@/components/summary-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { apiPost } from "@/lib/api-client";
import { MONTHS, formatIDR, formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";
import type { WarrantyClaim } from "@/lib/types";
import type { WarrantySyncSummary } from "@/lib/api/warranty-gsheet";
import { incompleteFieldsLabel } from "./warranty-incomplete";

/**
 * Claim Garansi BARDI — cermin tab "Raw Combine CG".
 *
 * Halaman ini BACA SAJA: seluruh isinya datang dari sync Google Sheet, jadi
 * tidak ada formulir tambah/ubah. Nilai Rupiah dihitung server dari Price List
 * app (harga Regional Warehouse bulan claim), bukan dari sheet.
 */
export default function WarrantyClaimsPage() {
  return (
    <>
      <WarrantyClaimsView />
    </>
  );
}

const monthLabel = (month: string) => {
  const [year, index] = month.split("-");
  const name = MONTHS[Number(index) - 1];
  return name ? `${name} ${year}` : month;
};

function WarrantyClaimsView() {
  const { t } = useLanguage();
  const { data, loading, error, reload } = useApi<WarrantyClaim[]>("/api/warranty-claims");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [product, setProduct] = useState("all");
  const [factory, setFactory] = useState("all");
  const [month, setMonth] = useState("all");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<WarrantyClaim | null>(null);
  const [syncResult, setSyncResult] = useState<WarrantySyncSummary | null>(null);
  const [syncing, setSyncing] = useState(false);

  const rows = useMemo(() => data ?? [], [data]);

  const statusOptions = useMemo(
    () => [...new Set(rows.map((row) => row.status).filter(Boolean))].sort(),
    [rows]
  );
  const productOptions = useMemo(
    () => [...new Set(rows.map((row) => row.officialName).filter(Boolean))].sort(),
    [rows]
  );
  const factoryOptions = useMemo(
    () => [...new Set(rows.map((row) => row.factoryName).filter(Boolean) as string[])].sort(),
    [rows]
  );
  const monthOptions = useMemo(
    () => [...new Set(rows.map((row) => row.month).filter(Boolean))].sort().reverse(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (product !== "all" && row.officialName !== product) return false;
      if (factory !== "all" && row.factoryName !== factory) return false;
      if (month !== "all" && row.month !== month) return false;
      if (onlyIncomplete && !row.incompleteFields) return false;
      if (!needle) return true;
      return [
        row.claimId,
        row.customerName,
        row.resi,
        row.resiUnit,
        row.officialName,
        row.productForm,
        row.factoryName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, search, status, product, factory, month, onlyIncomplete]);

  const totals = useMemo(
    () => ({
      quantity: filtered.reduce((sum, row) => sum + (row.quantity || 0), 0),
      value: filtered.reduce((sum, row) => sum + (row.value || 0), 0),
      incomplete: filtered.filter((row) => Boolean(row.incompleteFields)).length,
    }),
    [filtered]
  );

  const start = (page - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  async function handleSync() {
    setSyncing(true);
    try {
      const response = await apiPost<{ summary: WarrantySyncSummary }>(
        "/api/warranty-claims/gsheet/sync"
      );
      setSyncResult(response.summary);
      toast.success(
        t("warranty.syncDone", {
          created: response.summary.created,
          updated: response.summary.updated,
        })
      );
      reload();
    } catch (syncError) {
      toast.error((syncError as Error).message || t("warranty.syncFailed"));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("warranty.title")}
        description={t("warranty.description")}
        actions={
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {syncing ? t("warranty.syncing") : t("warranty.sync")}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummaryCard
          title={t("warranty.stat.qty")}
          value={formatNumber(totals.quantity)}
          description={t("warranty.stat.qtyDesc")}
          icon={Boxes}
        />
        <SummaryCard
          title={t("warranty.stat.value")}
          value={formatIDR(totals.value)}
          description={t("warranty.stat.valueDesc")}
          icon={Wallet}
        />
        <SummaryCard
          title={t("warranty.incomplete")}
          value={formatNumber(totals.incomplete)}
          description={t("warranty.incompleteHint")}
          icon={PackageCheck}
        />
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-3 pt-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="warranty-search">{t("common.search")}</Label>
            <Input
              id="warranty-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("warranty.searchPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("warranty.table.status")}</Label>
            <Select
              value={status}
              items={[
                { value: "all", label: t("warranty.allStatuses") },
                ...statusOptions.map((item) => ({ value: item, label: item })),
              ]}
              onValueChange={(value) => {
                setStatus(String(value));
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("warranty.allStatuses")}</SelectItem>
                {statusOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("warranty.table.product")}</Label>
            <Select
              value={product}
              items={[
                { value: "all", label: t("warranty.allProducts") },
                ...productOptions.map((item) => ({ value: item, label: item })),
              ]}
              onValueChange={(value) => {
                setProduct(String(value));
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("warranty.allProducts")}</SelectItem>
                {productOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("common.factory")}</Label>
            <Select
              value={factory}
              items={[
                { value: "all", label: t("header.allFactories") },
                ...factoryOptions.map((item) => ({ value: item, label: item })),
              ]}
              onValueChange={(value) => {
                setFactory(String(value));
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("header.allFactories")}</SelectItem>
                {factoryOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("warranty.table.date")}</Label>
            <Select
              value={month}
              items={[
                { value: "all", label: t("warranty.allMonths") },
                ...monthOptions.map((item) => ({ value: item, label: monthLabel(item) })),
              ]}
              onValueChange={(value) => {
                setMonth(String(value));
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("warranty.allMonths")}</SelectItem>
                {monthOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {monthLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={onlyIncomplete}
              onChange={(event) => {
                setOnlyIncomplete(event.target.checked);
                setPage(1);
              }}
            />
            {t("warranty.onlyIncomplete")}
          </label>
        </CardContent>
      </Card>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("warranty.empty")}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("warranty.table.date")}</TableHead>
                      <TableHead>{t("warranty.table.claim")}</TableHead>
                      <TableHead>{t("warranty.table.product")}</TableHead>
                      <TableHead>{t("common.factory")}</TableHead>
                      <TableHead className="text-right">{t("warranty.table.qty")}</TableHead>
                      <TableHead>{t("warranty.table.status")}</TableHead>
                      <TableHead>{t("warranty.table.collectionPoint")}</TableHead>
                      <TableHead className="text-right">{t("warranty.table.action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((row) => (
                      <TableRow key={row.id} data-warranty-id={row.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">{row.date || "—"}</TableCell>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {row.claimId || "—"}
                            {row.incompleteFields ? (
                              <Badge
                                variant="outline"
                                className="h-5 border-amber-500/50 px-1.5 text-[11px] text-amber-600"
                                title={`${t("warranty.incompleteHint")} ${incompleteFieldsLabel(t, row.incompleteFields)}`}
                              >
                                {t("warranty.incomplete")}
                              </Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate" title={row.officialName || row.productForm}>
                          {row.officialName || row.productForm || "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate" title={row.factoryName ?? ""}>
                          {row.factoryName || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(row.quantity)}</TableCell>
                        <TableCell>{row.status || "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={row.collectionPoint}>
                          {row.collectionPoint || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>
                            <Eye className="size-4" />
                            {t("warranty.detail")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                totalItems={filtered.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(open) => (open ? undefined : setDetail(null))}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("warranty.detailTitle")}</DialogTitle>
            <DialogDescription>{detail?.claimId ?? ""}</DialogDescription>
          </DialogHeader>
          {detail ? <WarrantyDetail row={detail} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={syncResult !== null}
        onOpenChange={(open) => (open ? undefined : setSyncResult(null))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("warranty.syncTitle")}</DialogTitle>
            <DialogDescription>{t("warranty.syncDescription")}</DialogDescription>
          </DialogHeader>
          {syncResult ? (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-2">
                <SyncStat label={t("warranty.sync.sheetRows")} value={syncResult.sheetRows} />
                <SyncStat label={t("warranty.sync.created")} value={syncResult.created} />
                <SyncStat label={t("warranty.sync.updated")} value={syncResult.updated} />
                <SyncStat label={t("warranty.sync.unchanged")} value={syncResult.unchanged} />
                <SyncStat label={t("warranty.sync.incomplete")} value={syncResult.incompleteRows} />
                <SyncStat label={t("warranty.sync.onlyInApp")} value={syncResult.onlyInApp} />
                <SyncStat label={t("warranty.sync.empty")} value={syncResult.skippedEmpty} />
                <SyncStat label={t("warranty.sync.noTimestamp")} value={syncResult.skippedNoTimestamp} />
                <SyncStat label={t("warranty.sync.removedNoTimestamp")} value={syncResult.removedNoTimestamp} />
              </dl>
              {syncResult.unknownProducts.length > 0 ? (
                <div>
                  <p className="font-medium">{t("warranty.sync.unknownProducts")}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {syncResult.unknownProducts.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SyncStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-base font-semibold tabular-nums">{formatNumber(value)}</dd>
    </div>
  );
}

function WarrantyDetail({ row }: { row: WarrantyClaim }) {
  const { t } = useLanguage();
  const fields: { label: string; value: string }[] = [
    { label: t("warranty.table.claim"), value: row.claimId || "—" },
    { label: t("warranty.field.timeStamp"), value: row.timeStamp.replace("T", " ") || "—" },
    { label: t("warranty.table.customer"), value: row.customerName || "—" },
    { label: t("warranty.field.phone"), value: row.customerPhone || "—" },
    { label: t("warranty.field.email"), value: row.customerEmail || "—" },
    { label: t("warranty.field.city"), value: row.city || "—" },
    { label: t("warranty.field.collectionPoint"), value: row.collectionPoint || "—" },
    { label: t("warranty.field.officialName"), value: row.officialName || "—" },
    { label: t("common.factory"), value: row.factoryName || "—" },
    { label: t("warranty.field.productForm"), value: row.productForm || "—" },
    { label: t("warranty.field.quantity"), value: formatNumber(row.quantity) },
    { label: t("warranty.field.status"), value: row.status || "—" },
    { label: t("warranty.field.sla"), value: row.sla || "—" },
    { label: t("warranty.field.pic"), value: row.pic || "—" },
    { label: t("warranty.field.courier"), value: row.courier || "—" },
    { label: t("warranty.field.resiUnit"), value: row.resiUnit || "—" },
    { label: t("warranty.field.resi"), value: row.resi || "—" },
    { label: t("warranty.field.value"), value: formatIDR(row.value) },
    { label: t("warranty.field.note"), value: row.note || "—" },
  ];

  return (
    <div className="space-y-3 text-sm">
      {row.incompleteFields ? (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-amber-700">
          {t("warranty.incompleteHint")} ({incompleteFieldsLabel(t, row.incompleteFields)})
        </p>
      ) : null}
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="break-words">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
