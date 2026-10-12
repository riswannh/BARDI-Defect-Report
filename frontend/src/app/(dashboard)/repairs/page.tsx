"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin-guard";
import { PageHeader } from "@/components/page-header";
import { SummaryCard } from "@/components/summary-card";
import { Pagination } from "@/components/pagination";
import { DeleteAllDialog } from "@/components/delete-all-dialog";
import { ImportResultDialog } from "@/components/import-result-dialog";
import {
  GsheetSyncDialog,
  type GsheetSyncResult,
} from "@/components/gsheet-sync-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Download,
  Eye,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Wallet,
  Wrench,
} from "lucide-react";
import { apiDelete, apiPatch, apiPost, apiUpload, downloadUrl } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { useLanguage } from "@/lib/i18n";
import { formatIDR, formatNumber, MONTHS } from "@/lib/format";
import { pickProductPrice } from "@/lib/prices";
import type {
  ImportResult,
  Product,
  ProductPrice,
  Problem,
  Repair,
  SparePart,
} from "@/lib/types";
import { RepairFormDialog, type RepairFormValues } from "./repair-form-dialog";
import { RepairDetailDialog } from "./repair-detail-dialog";

/** Jenis harga acuan Saving Value — sama dengan `DEFAULT_PRICE_TYPE` di server. */
const VALUE_PRICE_TYPE = "Regional Warehouse";

/**
 * Pilihan filter dropdown, disamakan dengan sheet "Reparasi RFB". Disalin dari
 * `REPAIR_ORIGINS`/`REPAIR_STATUSES` di `src/lib/api/validation.ts` supaya berkas
 * validasi server (memuat zod) tidak ikut ke bundel halaman.
 */
const ORIGIN_LABELS = [
  { value: "Distri", key: "repair.origin.distri" },
  { value: "OR", key: "repair.origin.or" },
  { value: "Customer", key: "repair.origin.customer" },
] as const;

const STATUS_LABELS = [
  { value: "Done Repair", key: "repair.status.doneRepair" },
  { value: "Proses", key: "repair.status.proses" },
  { value: "Belum Di Buka", key: "repair.status.belumDibuka" },
  { value: "Tidak Ada Data", key: "repair.status.tidakAdaData" },
  { value: "Done Kirim", key: "repair.status.doneKirim" },
] as const;

/** "2026-04" -> "04" (filter bulan; `Repair.month` disimpan sebagai "YYYY-MM"). */
const monthOf = (value: string) => (/^\d{4}-\d{2}$/.test(value) ? value.slice(5) : "");

export default function RepairsPage() {
  const { t } = useLanguage();
  const { data, loading, error, reload } = useApi<Repair[]>("/api/repairs");
  const { data: productData } = useApi<Product[]>("/api/products");
  const { data: problemData } = useApi<Problem[]>("/api/problems");
  const { data: sparePartData } = useApi<SparePart[]>("/api/spare-parts");
  const { data: priceData } = useApi<ProductPrice[]>("/api/product-prices");

  const rows = data ?? [];
  const products = productData ?? [];
  const problems = problemData ?? [];
  const spareParts = sparePartData ?? [];
  const productPrices = priceData ?? [];

  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Repair | null>(null);
  const [detail, setDetail] = useState<Repair | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Repair | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState<GsheetSyncResult | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [pageState, setPageState] = useState({ signature: "", page: 1 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const query = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const matchSearch =
      query === "" ||
      row.claimId.toLowerCase().includes(query) ||
      row.resi.toLowerCase().includes(query) ||
      row.customerName.toLowerCase().includes(query) ||
      (row.productName ?? "").toLowerCase().includes(query);
    const matchProduct =
      productFilter === "all" || String(row.productId) === productFilter;
    const matchStatus = statusFilter === "all" || row.status === statusFilter;
    const matchOrigin = originFilter === "all" || row.origin === originFilter;
    const matchMonth =
      monthFilter === "all" || monthOf(row.month) === monthFilter;
    const matchYear =
      yearFilter === "all" || row.month.slice(0, 4) === yearFilter;
    return (
      matchSearch &&
      matchProduct &&
      matchStatus &&
      matchOrigin &&
      matchMonth &&
      matchYear
    );
  });

  const totalQty = filtered.reduce((sum, row) => sum + row.quantity, 0);
  const totalValue = filtered.reduce((sum, row) => sum + row.value, 0);

  const signature = [
    query,
    productFilter,
    statusFilter,
    originFilter,
    monthFilter,
    yearFilter,
    pageSize,
    rows.length,
  ].join("|");
  if (pageState.signature !== signature) {
    setPageState({ signature, page: 1 });
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, pageState.page), totalPages);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const productName = (id: number) => {
    const row = rows.find((r) => r.id === id);
    return products.find((p) => p.id === id)?.name ?? row?.productName ?? "";
  };
  const years = [...new Set(rows.map((row) => row.month.slice(0, 4)))]
    .filter(Boolean)
    .sort()
    .reverse();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: Repair) {
    setEditing(row);
    setFormOpen(true);
  }

  /** Baris yang sedang diubah: form menghitung ulang Saving Value dari harga RW. */
  function formRow(row: Repair | null) {
    if (!row) return null;
    const rwPrice = pickProductPrice(
      productPrices,
      row.productId,
      row.month,
      row.priceType || VALUE_PRICE_TYPE
    );
    const savedValue =
      row.value > 0
        ? row.value
        : Math.round(Number(rwPrice?.price ?? 0) * row.quantity);
    return { ...row, value: savedValue };
  }

  async function handleSave(values: RepairFormValues, editingId: number | null) {
    if (editingId === null) {
      await apiPost("/api/repairs", values);
    } else {
      await apiPatch(`/api/repairs/${editingId}`, values);
    }
    toast.success(t("repair.saved"));
    reload();
    return true;
  }

  async function handleDelete(row: Repair) {
    try {
      await apiDelete(`/api/repairs/${row.id}`);
      toast.success(t("repair.deleted"));
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function handleDeleteAll() {
    try {
      const result = await apiDelete<{ deleted: number }>("/api/repairs");
      toast.success(t("repair.deletedAll", { count: result.deleted }));
      setDeleteAllOpen(false);
      setSelected([]);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function handleBulkDelete() {
    try {
      const result = await apiPost<{ deleted: number }>(
        "/api/repairs/bulk-delete",
        { ids: selected }
      );
      toast.success(t("repair.deletedAll", { count: result.deleted }));
      setBulkOpen(false);
      setSelected([]);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await apiUpload<ImportResult>(
        "/api/excel/repairs/import",
        file
      );
      setImportResult(result);
      setImportOpen(true);
      toast.success(
        t("repair.importDone", {
          inserted: result.inserted,
          skipped: result.skipped,
          failed: result.errors.length,
        })
      );
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
    e.target.value = "";
  }

  async function runSheetSync() {
    setSyncOpen(true);
    setSyncBusy(true);
    try {
      const response = await apiPost<{
        ok: boolean;
        result: ImportResult;
        summary: { inserted: number; rowsUpdated: number; conflicts: number };
        tab: string;
      }>("/api/repairs/gsheet/sync", {});
      // Dialog sinkron menampilkan `ImportResult`; ringkasannya dipakai untuk toast.
      setSyncResult({
        ok: response.ok,
        tab: response.tab,
        summary: response.summary as GsheetSyncResult["summary"],
        conflicts: [],
        issues: [],
        conflictsTruncated: false,
      });
      toast.success(
        t("repair.syncDone", {
          inserted: response.summary.inserted,
          updated: response.summary.rowsUpdated,
          conflicts: response.summary.conflicts,
        })
      );
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSyncBusy(false);
    }
  }

  const allSelected = paged.length > 0 && paged.every((row) => selected.includes(row.id));

  return (
    <AdminGuard>
      <div>
        <PageHeader
          title={t("repair.title")}
          description={t("repair.description")}
          actions={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadUrl("/api/excel/repairs/template")}
              >
                <FileDown className="size-4" /> {t("common.template")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" /> {t("common.importExcel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadUrl("/api/excel/repairs/export")}
              >
                <Download className="size-4" /> {t("common.exportExcel")}
              </Button>
              {importResult && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                >
                  {t("import.lastResult")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={runSheetSync}
                disabled={syncBusy}
              >
                {syncBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("gsheet.button")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteAllOpen(true)}
              >
                <Trash2 className="size-4" /> {t("deleteAll.button")}
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> {t("common.add")}
              </Button>
            </>
          }
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            title={t("repair.totalQty")}
            value={formatNumber(totalQty)}
            icon={Wrench}
          />
          <SummaryCard
            title={t("repair.totalValue")}
            value={formatIDR(totalValue)}
            icon={Wallet}
          />
        </div>

        <Card size="sm" className="mb-6">
          <CardContent className="flex flex-wrap items-end gap-4 pt-4">
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <Label htmlFor="repair-search">{t("common.search")}</Label>
              <Input
                id="repair-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("repair.searchPlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("common.product")}</Label>
              <Select
                value={productFilter}
                onValueChange={(v) => setProductFilter(String(v))}
                items={[
                  { value: "all", label: t("repair.allProducts") },
                  ...products.map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              >
                <SelectTrigger id="repair-filter-product" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("repair.allProducts")}</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("common.status")}</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(String(v))}
                items={[
                  { value: "all", label: t("repair.allStatuses") },
                  ...STATUS_LABELS.map((s) => ({
                    value: s.value,
                    label: t(s.key),
                  })),
                ]}
              >
                <SelectTrigger id="repair-filter-status" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("repair.allStatuses")}</SelectItem>
                  {STATUS_LABELS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(s.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("repair.form.origin")}</Label>
              <Select
                value={originFilter}
                onValueChange={(v) => setOriginFilter(String(v))}
                items={[
                  { value: "all", label: t("repair.allOrigins") },
                  ...ORIGIN_LABELS.map((o) => ({
                    value: o.value,
                    label: t(o.key),
                  })),
                ]}
              >
                <SelectTrigger id="repair-filter-origin" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("repair.allOrigins")}</SelectItem>
                  {ORIGIN_LABELS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {t(o.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("common.month")}</Label>
              <Select
                value={monthFilter}
                onValueChange={(v) => setMonthFilter(String(v))}
                items={[
                  { value: "all", label: t("repair.allMonths") },
                  ...MONTHS.map((name, index) => ({
                    value: String(index + 1).padStart(2, "0"),
                    label: name,
                  })),
                ]}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("repair.allMonths")}</SelectItem>
                  {MONTHS.map((name, index) => {
                    const value = String(index + 1).padStart(2, "0");
                    return (
                      <SelectItem key={value} value={value}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("repair.form.year")}</Label>
              <Select
                value={yearFilter}
                onValueChange={(v) => setYearFilter(String(v))}
                items={[
                  { value: "all", label: t("repair.allYears") },
                  ...years.map((y) => ({ value: y, label: y })),
                ]}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("repair.allYears")}</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {t("bulk.selected", { count: selected.length })}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                <Trash2 className="size-4" /> {t("bulk.delete")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                {t("bulk.clear")}
              </Button>
            </div>
          </div>
        )}

        <Card size="sm">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={allSelected}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? paged.map((row) => row.id) : []
                          )
                        }
                        aria-label={t("bulk.selected", { count: 0 })}
                      />
                    </TableHead>
                    <TableHead>{t("repair.table.date")}</TableHead>
                    <TableHead>{t("repair.table.claim")}</TableHead>
                    <TableHead>{t("common.product")}</TableHead>
                    <TableHead>{t("common.qty")}</TableHead>
                    <TableHead>{t("common.valueIdr")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("repair.table.customer")}</TableHead>
                    <TableHead>{t("repair.table.resi")}</TableHead>
                    <TableHead>{t("repair.table.pic")}</TableHead>
                    <TableHead className="text-right">
                      {t("repair.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((row) => (
                    <TableRow key={row.id} data-repair-id={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selected.includes(row.id)}
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, row.id]
                                : prev.filter((id) => id !== row.id)
                            )
                          }
                          aria-label={row.claimId}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {row.date}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.claimId}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {row.productName ?? productName(row.productId) ?? "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatNumber(row.quantity)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatIDR(row.value)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {row.status || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {row.customerName || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.resi || "-"}
                      </TableCell>
                      <TableCell>{row.pic || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDetail(row)}
                            aria-label={t("repair.detailTitle")}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(row)}
                            aria-label={t("bulk.edit")}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(row)}
                            aria-label={t("bulk.delete")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paged.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="py-6 text-center text-muted-foreground"
                      >
                        {loading
                          ? t("common.loading")
                          : error
                            ? error
                            : rows.length === 0
                              ? t("repair.empty")
                              : t("common.noResults")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4">
              <Pagination
                totalItems={filtered.length}
                page={page}
                pageSize={pageSize}
                onPageChange={(next) => setPageState({ signature, page: next })}
                onPageSizeChange={setPageSize}
              />
            </div>
          </CardContent>
        </Card>

        <RepairFormDialog
          // `key` me-remount form saat baris yang diubah berganti, jadi nilai
          // awalnya dihitung sekali dan tidak perlu effect penyalin state.
          key={`${formOpen ? "open" : "closed"}-${editing?.id ?? "new"}`}
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditing(null);
          }}
          row={formRow(editing)}
          products={products}
          problems={problems}
          spareParts={spareParts}
          productPrices={productPrices}
          onSave={handleSave}
        />

        <RepairDetailDialog
          repair={detail}
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
          spareParts={spareParts}
        />

        <ImportResultDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          result={importResult}
        />

        <GsheetSyncDialog
          open={syncOpen}
          onOpenChange={setSyncOpen}
          result={syncResult}
          busy={syncBusy}
          onResolve={() => setSyncOpen(false)}
          title={t("repair.syncTitle")}
          description={t("repair.syncDescription")}
        />

        <DeleteAllDialog
          open={deleteAllOpen}
          onOpenChange={setDeleteAllOpen}
          label={t("repair.title")}
          onConfirm={handleDeleteAll}
        />

        <DeleteAllDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          label={deleteTarget?.claimId ?? ""}
          title={t("deleteAll.title", { label: deleteTarget?.claimId ?? "" })}
          onConfirm={async () => {
            if (deleteTarget) await handleDelete(deleteTarget);
          }}
        />

        <DeleteAllDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          label={t("repair.title")}
          title={t("bulk.deleteTitle", { count: selected.length })}
          description={t("bulk.deleteWarning", { count: selected.length })}
          onConfirm={handleBulkDelete}
        />
      </div>
    </AdminGuard>
  );
}
