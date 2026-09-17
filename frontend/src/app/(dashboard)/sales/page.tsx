"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { formatIDR, formatNumber, MONTHS } from "@/lib/format";
import {
  apiDelete,
  apiPatch,
  apiPost,
  apiUpload,
  downloadUrl,
} from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type { Factory, ImportResult, Product, Sale } from "@/lib/types";
import { productName } from "@/lib/analytics";
import { AdminGuard } from "@/components/admin-guard";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  FileDown,
  History,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";

interface SaleRow extends Omit<Sale, "value"> {
  value?: number;
  productName?: string | null;
  factoryName?: string | null;
}

interface SaleForm {
  productId: string;
  factoryId: string;
  month: string;
  quantity: string;
  value: string;
}

const emptyForm: SaleForm = {
  productId: "",
  factoryId: "",
  month: "Jan",
  quantity: "",
  value: "",
};

export default function SalesPage() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  const { data: saleData, loading, reload } = useApi<SaleRow[]>("/api/sales");
  const { data: productData } = useApi<Product[]>("/api/products");
  const { data: factoryData } = useApi<Factory[]>("/api/factories");

  const products = productData ?? [];
  const factories = factoryData ?? [];

  const productOptions = products.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));
  const factoryOptions = factories.map((f) => ({
    value: String(f.id),
    label: f.name,
  }));

  // Role Pabrik: filter produk hanya berisi produk yang punya data sales di pabriknya
  const scopedProductOptions = useMemo(() => {
    const allProducts = productData ?? [];
    if (isAdmin) {
      return allProducts.map((p) => ({ value: String(p.id), label: p.name }));
    }
    const seen = new Map<number, string>();
    for (const s of saleData ?? []) {
      const name =
        s.productName ?? allProducts.find((p) => p.id === s.productId)?.name;
      if (name) seen.set(s.productId, name);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: String(id), label: name }));
  }, [isAdmin, saleData, productData]);

  const [filterProduct, setFilterProduct] = useState("all");
  const [filterFactory, setFilterFactory] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editQueue, setEditQueue] = useState<number[]>([]);
  const [editIndex, setEditIndex] = useState(0);
  const editingId = editQueue.length > 0 ? editQueue[editIndex] : null;
  const [form, setForm] = useState<SaleForm>(emptyForm);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filterSignature = [filterProduct, filterFactory, filterMonth, search].join(
    "|"
  );
  const [pageState, setPageState] = useState({
    signature: filterSignature,
    page: 1,
  });
  const page =
    pageState.signature === filterSignature ? pageState.page : 1;
  const setPage = (next: number) =>
    setPageState({ signature: filterSignature, page: next });
  const [pageSize, setPageSize] = useState(10);

  const visibleSales = useMemo(() => {
    const sales = saleData ?? [];
    const products = productData ?? [];
    const factories = factoryData ?? [];
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (filterProduct !== "all" && s.productId !== Number(filterProduct))
        return false;
      if (filterFactory !== "all" && s.factoryId !== Number(filterFactory))
        return false;
      if (filterMonth !== "all" && s.month !== filterMonth) return false;
      if (q) {
        const haystack = [
          productName(products, s.productId),
          factories.find((f) => f.id === s.factoryId)?.name ?? "",
          s.month,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    saleData,
    productData,
    factoryData,
    filterProduct,
    filterFactory,
    filterMonth,
    search,
  ]);

  const totalPages = Math.max(1, Math.ceil(visibleSales.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedSales = visibleSales.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalQty = visibleSales.reduce((sum, s) => sum + s.quantity, 0);
  const totalVal = visibleSales.reduce((sum, s) => sum + (s.value ?? 0), 0);

  function loadForm(id: number) {
    const s = (saleData ?? []).find((row) => row.id === id);
    if (!s) return;
    setForm({
      productId: String(s.productId),
      factoryId: String(s.factoryId),
      month: s.month,
      quantity: String(s.quantity),
      value: String(s.value ?? 0),
    });
  }

  function openCreate() {
    setEditQueue([]);
    setEditIndex(0);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(s: SaleRow) {
    setEditQueue([s.id]);
    setEditIndex(0);
    loadForm(s.id);
    setDialogOpen(true);
  }

  function startBulkEdit() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setEditQueue(ids);
    setEditIndex(0);
    loadForm(ids[0]);
    setDialogOpen(true);
  }

  function finishEditFlow() {
    setEditQueue([]);
    setEditIndex(0);
    setDialogOpen(false);
    setSelectedIds(new Set());
    reload();
  }

  function advanceEdit() {
    if (editQueue.length === 0) return;
    const next = editIndex + 1;
    if (next < editQueue.length) {
      setEditIndex(next);
      loadForm(editQueue[next]);
    } else {
      finishEditFlow();
    }
  }

  /**
   * Menutup dialog = benar-benar menutup.
   *
   * Sebelumnya fungsi ini memanggil `advanceEdit()` saat `open === false`, dan
   * `advanceEdit()` langsung `return` ketika antrean edit kosong — sehingga
   * dialog form TAMBAH tidak bisa ditutup sama sekali, baik lewat tombol X
   * maupun Escape. Pada mode edit pun X berpindah ke baris antrean berikutnya
   * alih-alih menutup. Perpindahan antrean sekarang hanya terjadi setelah
   * SIMPAN berhasil (lihat handleSubmit), bukan saat dialog dibatalkan.
   */
  function handleDialogOpenChange(open: boolean) {
    if (open) {
      setDialogOpen(true);
      return;
    }
    setDialogOpen(false);
    setEditQueue([]);
    setEditIndex(0);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      productId: Number(form.productId),
      factoryId: Number(form.factoryId),
      month: form.month,
      quantity: Number(form.quantity) || 0,
      value: Number(form.value) || 0,
    };
    if (!payload.productId || !payload.factoryId) return;

    try {
      if (editingId === null) {
        await apiPost("/api/sales", payload);
        setDialogOpen(false);
        reload();
      } else {
        await apiPatch(`/api/sales/${editingId}`, payload);
        advanceEdit();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  const allPageSelected =
    pagedSales.length > 0 && pagedSales.every((s) => selectedIds.has(s.id));

  function toggleAllPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const s of pagedSales) next.delete(s.id);
      } else {
        for (const s of pagedSales) next.add(s.id);
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

  async function handleBulkDelete() {
    try {
      const res = await apiPost<{ deleted: number }>("/api/sales/bulk-delete", {
        ids: Array.from(selectedIds),
      });
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/sales/${id}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function handleDeleteAll() {
    try {
      const res = await apiDelete<{ deleted: number }>("/api/sales");
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setDeleteAllOpen(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await apiUpload<ImportResult>(
        "/api/excel/sales/import",
        file
      );
      setImportResult(result);
      setImportDialogOpen(true);
      toast.success(
        `Import selesai: ${result.inserted} masuk, ${result.skipped} dilewati, ${result.errors.length} gagal.`
      );
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal import.");
    }
    e.target.value = "";
  }

  return (
    <AdminGuard>
      <div>
      <PageHeader
        title={t("sales.title")}
        description={t("sales.description")}
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
                onClick={() => downloadUrl("/api/excel/sales/template")}
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
                onClick={() => downloadUrl("/api/excel/sales/export")}
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

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId === null
                ? t("sales.addTitle")
                : editQueue.length > 1
                  ? `${t("sales.editTitle")} (${editIndex + 1}/${editQueue.length})`
                  : t("sales.editTitle")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.product")}</Label>
              <Select
                value={form.productId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, productId: String(v) }))
                }
                items={productOptions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.factory")}</Label>
              <Select
                value={form.factoryId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, factoryId: String(v) }))
                }
                items={factoryOptions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {factories.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.month")}</Label>
              <Select
                value={form.month}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, month: String(v) }))
                }
              >
                <SelectTrigger className="w-full">
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
              <Label>{t("common.quantity")}</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
                placeholder="0"
              />
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.valueIdr")}</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            )}
            <DialogFooter>
              <Button type="submit">
                {editingId === null
                  ? t("common.save")
                  : t("common.update")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          title={t("sales.totalQty")}
          value={formatNumber(totalQty)}
          icon={ShoppingCart}
        />
        {isAdmin && (
          <SummaryCard
            title={t("sales.totalValue")}
            value={formatIDR(totalVal)}
            icon={Wallet}
          />
        )}
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.product")}</Label>
            <Select
              value={filterProduct}
              onValueChange={(v) => setFilterProduct(String(v))}
              items={[
                { value: "all", label: t("sales.allProducts") },
                ...scopedProductOptions,
              ]}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-80">
                <SelectItem value="all">{t("sales.allProducts")}</SelectItem>
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
                onValueChange={(v) => setFilterFactory(String(v))}
                items={[
                  { value: "all", label: t("header.allFactories") },
                  ...factoryOptions,
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
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.month")}</Label>
            <Select
              value={filterMonth}
              onValueChange={(v) => setFilterMonth(String(v))}
              items={[
                { value: "all", label: t("common.all") },
                ...MONTHS.map((m) => ({ value: m, label: m })),
              ]}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.search")}</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("sales.searchPlaceholder")}
              className="w-56"
            />
          </div>
        </CardContent>

        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-xs font-medium">
              {t("bulk.selected", { count: selectedIds.size })}
            </span>
            <Button size="sm" variant="outline" onClick={startBulkEdit}>
              <Pencil className="size-4" /> {t("bulk.edit")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> {t("bulk.delete")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              {t("bulk.clear")}
            </Button>
          </div>
        )}

        <div className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={allPageSelected}
                    onChange={toggleAllPage}
                    aria-label="Pilih semua"
                  />
                </TableHead>
                <TableHead>{t("common.product")}</TableHead>
                <TableHead>{t("common.factory")}</TableHead>
                <TableHead>{t("common.month")}</TableHead>
                <TableHead className="text-right">
                  {t("common.quantity")}
                </TableHead>
                {isAdmin && (
                  <TableHead className="text-right">
                    {t("common.value")}
                  </TableHead>
                )}
                {isAdmin && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedSales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleOne(s.id)}
                      aria-label={`Pilih ${productName(products, s.productId)}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {productName(products, s.productId)}
                  </TableCell>
                  <TableCell>
                    {factories.find((f) => f.id === s.factoryId)?.name ?? "-"}
                  </TableCell>
                  <TableCell>{s.month}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(s.quantity)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {formatIDR(s.value ?? 0)}
                    </TableCell>
                  )}
                  {isAdmin && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {visibleSales.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 7 : 5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {loading ? t("common.loading") : t("common.noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {visibleSales.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination
              totalItems={visibleSales.length}
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
      </Card>

      <ImportResultDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        result={importResult}
      />

      <DeleteAllDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        label={t("sales.title")}
        onConfirm={handleDeleteAll}
      />

      <DeleteAllDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        label={t("sales.title")}
        title={t("bulk.deleteTitle", { count: selectedIds.size })}
        description={t("bulk.deleteWarning", { count: selectedIds.size })}
        confirmLabel={t("bulk.delete")}
        onConfirm={handleBulkDelete}
      />
      </div>
    </AdminGuard>
  );
}
