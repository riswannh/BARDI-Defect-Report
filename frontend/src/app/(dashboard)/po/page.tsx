"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { formatNumber, formatPoCurrency } from "@/lib/format";
import {
  apiDelete,
  apiPatch,
  apiPost,
  apiUpload,
  downloadUrl,
} from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type {
  Factory,
  ImportResult,
  Product,
  PurchaseOrder,
} from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { DeleteAllDialog } from "@/components/delete-all-dialog";
import { ImportResultDialog } from "@/components/import-result-dialog";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SummaryCard } from "@/components/summary-card";
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
  Boxes,
  Download,
  FileDown,
  History,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  PoFormDialog,
  emptyPoForm,
  productOptionLabel,
  type PoForm,
} from "./po-form-dialog";

export default function PoPage() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  const { data: poData, loading, reload } = useApi<PurchaseOrder[]>(
    "/api/purchase-orders"
  );
  const { data: productData } = useApi<Product[]>("/api/products");
  const { data: factoryData } = useApi<Factory[]>("/api/factories");

  // `?? []` membuat array baru tiap render dan itu membuat useMemo di bawah
  // selalu dianggap usang; memo dipakai agar hanya dihitung ulang saat data
  // dari API benar-benar berubah.
  const products = useMemo(() => productData ?? [], [productData]);
  const factories = useMemo(() => factoryData ?? [], [factoryData]);
  const rows = useMemo(() => poData ?? [], [poData]);

  const [filterProduct, setFilterProduct] = useState("all");
  const [filterFactory, setFilterFactory] = useState("all");
  const [keterangan, setKeterangan] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PoForm>(() => emptyPoForm());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Entri terakhir yang tersimpan — sumber nilai yang dibawa ke entri berikutnya.
  const lastEntryRef = useRef<PoForm | null>(null);

  // Filter dilakukan di klien agar sama persis dengan halaman Sales, dengan
  // tambahan filter Keterangan.
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ket = keterangan.trim().toLowerCase();
    return rows.filter((row) => {
      if (filterProduct !== "all" && row.productId !== Number(filterProduct))
        return false;
      if (filterFactory !== "all" && row.factoryId !== Number(filterFactory))
        return false;
      if (ket && !row.keterangan.toLowerCase().includes(ket)) return false;
      if (q) {
        const haystack = [
          row.poNumber,
          row.keterangan,
          row.productName ?? "",
          row.factoryName ?? "",
          row.sku ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterProduct, filterFactory, keterangan, search]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = visibleRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalQuantity = visibleRows.reduce((sum, row) => sum + row.quantity, 0);

  // Role Pabrik: pilihan produk dibatasi ke produk yang ada di PO pabriknya.
  const scopedProductOptions = useMemo(() => {
    if (isAdmin) {
      return products.map((p) => ({
        value: String(p.id),
        label: productOptionLabel(p),
      }));
    }
    const seen = new Map<number, string>();
    for (const row of rows) {
      const name =
        row.productName ?? products.find((p) => p.id === row.productId)?.name;
      if (name) seen.set(row.productId, row.sku ? `${row.sku} — ${name}` : name);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]) => ({ value: String(id), label }));
  }, [isAdmin, rows, products]);

  function openCreate() {
    const previous = lastEntryRef.current;
    // Satu PO biasanya berisi beberapa produk, jadi PO Number dan Pabrik dibawa
    // dari entri sebelumnya; produk/qty/harga dikosongkan.
    setForm(
      previous
        ? {
            ...emptyPoForm(),
            poNumber: previous.poNumber,
            factoryId: previous.factoryId,
            currency: previous.currency,
            keterangan: previous.keterangan,
          }
        : emptyPoForm()
    );
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(row: PurchaseOrder) {
    setForm({
      poNumber: row.poNumber,
      sku: row.sku ?? "",
      productId: String(row.productId),
      factoryId: String(row.factoryId),
      quantity: String(row.quantity),
      pricePerPcs: String(row.pricePerPcs ?? 0),
      currency: (row.currency as PoForm["currency"]) ?? "Rp",
      keterangan: row.keterangan,
    });
    setEditingId(row.id);
    setDialogOpen(true);
  }

  async function handleSubmit(mode: "save" | "saveAndAddAnother" = "save") {
    const payload = {
      poNumber: form.poNumber.trim(),
      productId: Number(form.productId),
      factoryId: Number(form.factoryId),
      quantity: Number(form.quantity) || 0,
      pricePerPcs: Number(form.pricePerPcs) || 0,
      currency: form.currency,
      keterangan: form.keterangan.trim(),
    };
    if (!payload.poNumber || !payload.productId || !payload.factoryId) {
      toast.error(t("po.incomplete"));
      return;
    }

    try {
      if (editingId === null) {
        await apiPost("/api/purchase-orders", payload);
        lastEntryRef.current = form;
        if (mode === "saveAndAddAnother") {
          setForm((f) => ({
            ...emptyPoForm(),
            poNumber: f.poNumber,
            factoryId: f.factoryId,
            currency: f.currency,
            keterangan: f.keterangan,
          }));
          reload();
          toast.success(t("po.savedNext"));
          return;
        }
        setDialogOpen(false);
        reload();
      } else {
        await apiPatch(`/api/purchase-orders/${editingId}`, payload);
        setDialogOpen(false);
        reload();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("po.saveFailed"));
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/purchase-orders/${id}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("po.deleteFailed"));
    }
  }

  async function handleBulkDelete() {
    try {
      const res = await apiPost<{ deleted: number }>(
        "/api/purchase-orders/bulk-delete",
        { ids: Array.from(selectedIds) }
      );
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("po.deleteFailed"));
    }
  }

  async function handleDeleteAll() {
    try {
      const res = await apiDelete<{ deleted: number }>(
        "/api/purchase-orders"
      );
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setDeleteAllOpen(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("po.deleteFailed"));
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await apiUpload<ImportResult>(
        "/api/excel/purchase-orders/import",
        file
      );
      setImportResult(result);
      setImportDialogOpen(true);
      toast.success(
        t("po.importDone", {
          inserted: result.inserted,
          skipped: result.skipped,
          failed: result.errors.length,
        })
      );
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("po.importFailed"));
    }
    e.target.value = "";
  }

  const allPageSelected =
    pagedRows.length > 0 && pagedRows.every((row) => selectedIds.has(row.id));

  function toggleAllPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const row of pagedRows) next.delete(row.id);
      } else {
        for (const row of pagedRows) next.add(row.id);
      }
      return next;
    });
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Admin: checkbox pilih + Price/pcs + Total Currency + kolom aksi.
  const columnCount = isAdmin ? 9 : 5;

  return (
    // AuthGuard, bukan AdminGuard: halaman PO memang dibuka untuk role Pabrik
    // (read-only, tanpa harga/total/mata uang). Semua kontrol tulis sudah
    // dibungkus `isAdmin` di dalamnya.
    <AuthGuard>
      <div>
        <PageHeader
          title={t("po.title")}
          description={t("po.description")}
          actions={
            isAdmin && (
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
                  onClick={() =>
                    downloadUrl("/api/excel/purchase-orders/template")
                  }
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
                  onClick={() =>
                    downloadUrl("/api/excel/purchase-orders/export")
                  }
                >
                  <Download className="size-4" /> {t("common.exportExcel")}
                </Button>
                {importResult && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    <History className="size-4" /> {t("import.lastResult")}
                  </Button>
                )}
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
            )
          }
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title={t("po.totalQuantity")}
            value={formatNumber(totalQuantity)}
            description={t("common.quantity")}
            icon={Boxes}
          />
        </div>

        <Card size="sm">
          <CardContent className="flex flex-wrap items-end gap-4 pt-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.product")}</Label>
              <Select
                value={filterProduct}
                onValueChange={(v) => {
                  setFilterProduct(String(v));
                  setPage(1);
                }}
                items={[
                  { value: "all", label: t("defects.allProducts") },
                  ...scopedProductOptions,
                ]}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("defects.allProducts")}</SelectItem>
                  {scopedProductOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.factory")}</Label>
                <Select
                  value={filterFactory}
                  onValueChange={(v) => {
                    setFilterFactory(String(v));
                    setPage(1);
                  }}
                  items={[
                    { value: "all", label: t("header.allFactories") },
                    ...factories.map((f) => ({
                      value: String(f.id),
                      label: f.name,
                    })),
                  ]}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("header.allFactories")}
                    </SelectItem>
                    {factories.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-filter-keterangan">{t("po.keterangan")}</Label>
              <Input
                id="po-filter-keterangan"
                value={keterangan}
                onChange={(e) => {
                  setKeterangan(e.target.value);
                  setPage(1);
                }}
                placeholder={t("po.filterKeterangan")}
                className="w-52"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="po-filter-search">{t("common.search")}</Label>
              <Input
                id="po-filter-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("po.searchPlaceholder")}
                className="w-56"
              />
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="mt-4">
          {isAdmin && selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-sm">
              <span className="text-muted-foreground">
                {t("po.selected", { count: selectedIds.size })}
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="size-4" /> {t("bulk.delete")}
              </Button>
            </div>
          )}
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label={t("po.selectAll")}
                          checked={allPageSelected}
                          onChange={toggleAllPage}
                          className="size-4 accent-primary"
                        />
                      </TableHead>
                    )}
                    <TableHead>{t("po.poNumber")}</TableHead>
                    <TableHead>{t("po.keterangan")}</TableHead>
                    <TableHead>{t("po.productName")}</TableHead>
                    <TableHead>{t("common.factory")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.quantity")}
                    </TableHead>
                    {isAdmin && (
                      <>
                        <TableHead className="text-right">
                          {t("po.pricePerPcs")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("po.totalCurrency")}
                        </TableHead>
                      </>
                    )}
                    {isAdmin && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row) => (
                    <TableRow key={row.id}>
                      {isAdmin && (
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={t("po.selectRow", {
                              po: row.poNumber,
                            })}
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            className="size-4 accent-primary"
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">
                        {row.poNumber}
                      </TableCell>
                      <TableCell className="max-w-48 truncate" title={row.keterangan}>
                        {row.keterangan || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.productName ?? "-"}
                      </TableCell>
                      <TableCell>{row.factoryName ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.quantity)}
                      </TableCell>
                      {isAdmin && (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {formatPoCurrency(
                              row.pricePerPcs ?? 0,
                              row.currency
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatPoCurrency(row.value ?? 0, row.currency)}
                          </TableCell>
                        </>
                      )}
                      {isAdmin && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("common.update")}
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("bulk.delete")}
                              onClick={() => handleDelete(row.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {pagedRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={columnCount}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {loading ? t("common.loading") : t("common.noData")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {visibleRows.length > 0 && (
              <div className="mt-4">
                <Pagination
                  totalItems={visibleRows.length}
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
          </CardContent>
        </Card>

        {isAdmin && (
          <PoFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            editingId={editingId}
            form={form}
            onFormChange={setForm}
            onSubmit={handleSubmit}
            products={products}
            factories={factories}
          />
        )}

        <ImportResultDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          result={importResult}
        />

        <DeleteAllDialog
          open={deleteAllOpen}
          onOpenChange={setDeleteAllOpen}
          label={t("po.title")}
          onConfirm={handleDeleteAll}
        />

        <DeleteAllDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          label={t("po.title")}
          title={t("bulk.deleteTitle", { count: selectedIds.size })}
          description={t("bulk.deleteWarning", { count: selectedIds.size })}
          confirmLabel={t("bulk.delete")}
          onConfirm={handleBulkDelete}
        />
      </div>
    </AuthGuard>
  );
}
