"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { formatDateTime, formatIDR, formatNumber, formatPoCurrency, formatPoCurrencyCompact, MONTHS } from "@/lib/format";
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
  ProductPrice,
  PurchaseOrder,
} from "@/lib/types";
import { DEFAULT_KETERANGAN, KETERANGAN_OPTIONS } from "@/lib/api/validation";
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
  FlaskConical,
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
import { poDemoEnabled } from "./po-demo";
import {
  demoFactories,
  demoProducts,
  demoPurchaseOrders,
  demoPurchaseOrdersForFactory,
} from "./po-demo-data";

export default function PoPage() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  // Mode demo: seluruh data (termasuk daftar produk dan pabrik) datang dari
  // `po-demo-data.ts`, dan url `null` membuat `useApi` tidak memanggil API sama
  // sekali — jadi tidak ada data asli yang dibaca maupun ditulis.
  const { data: poData, loading, reload } = useApi<PurchaseOrder[]>(
    poDemoEnabled ? null : "/api/purchase-orders"
  );
  const { data: productData } = useApi<Product[]>(
    poDemoEnabled ? null : "/api/products"
  );
  const { data: factoryData } = useApi<Factory[]>(
    poDemoEnabled ? null : "/api/factories"
  );
  // Harga master per bulan/tahun, dipakai untuk memilih harga dan menghitung
  // Value RW (Quantity × Harga).
  const { data: priceData } = useApi<ProductPrice[]>(
    poDemoEnabled ? null : "/api/product-prices"
  );

  // `?? []` membuat array baru tiap render dan itu membuat useMemo di bawah
  // selalu dianggap usang; memo dipakai agar hanya dihitung ulang saat data
  // dari API benar-benar berubah.
  const products = useMemo(
    () => (poDemoEnabled ? demoProducts : productData ?? []),
    [productData]
  );
  const factories = useMemo(
    () => (poDemoEnabled ? demoFactories : factoryData ?? []),
    [factoryData]
  );
  const productPrices = useMemo(() => priceData ?? [], [priceData]);
  const rows = useMemo(
    () =>
      poDemoEnabled
        ? isAdmin
          ? demoPurchaseOrders
          : demoPurchaseOrdersForFactory()
        : poData ?? [],
    [poData, isAdmin]
  );

  const [filterProduct, setFilterProduct] = useState("all");
  const [filterFactory, setFilterFactory] = useState("all");
  // Keterangan adalah nilai tetap, jadi filternya mencocokkan nama langsung.
  const [filterKeterangan, setFilterKeterangan] = useState("all");
  // Filter per bulan: "all" = semua bulan. Tahun ikut menyaring agar data lintas
  // tahun tidak tercampur ketika satu bulan dipilih.
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
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
    return rows.filter((row) => {
      if (filterProduct !== "all" && row.productId !== Number(filterProduct))
        return false;
      if (filterFactory !== "all" && row.factoryId !== Number(filterFactory))
        return false;
      if (
        filterKeterangan !== "all" &&
        row.keterangan !== filterKeterangan
      )
        return false;
      if (filterMonth !== "all" || filterYear !== "all") {
        // Timestamp berformat `YYYY-MM-DDTHH:mm`, jadi bulan dan tahun dibaca
        // langsung dari string — bukan lewat Date, supaya tidak bergeser akibat
        // konversi zona waktu.
        const stamp = row.poDate ?? "";
        const year = stamp.slice(0, 4);
        const month = stamp.slice(5, 7);
        if (filterYear !== "all" && year !== filterYear) return false;
        if (filterMonth !== "all" && month !== filterMonth) return false;
      }
      if (q) {
        const haystack = [
          row.poNumber,
          row.keterangan ?? "",
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
  }, [
    rows,
    filterProduct,
    filterFactory,
    filterKeterangan,
    filterMonth,
    filterYear,
    search,
  ]);

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

  // Pilihan tahun untuk filter, diambil dari data yang ada supaya dropdownnya
  // tidak menawarkan tahun yang memang belum punya baris PO.
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    for (const row of rows) {
      const year = (row.poDate ?? "").slice(0, 4);
      if (year) years.add(year);
    }
    return Array.from(years)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: value }));
  }, [rows]);

  // Keterangan kini nilai tetap di kode — tidak ada endpoint master lagi.
  const keteranganOptions = useMemo(
    () => KETERANGAN_OPTIONS.map((option) => ({ value: option, label: option })),
    []
  );

  function openCreate() {
    const previous = lastEntryRef.current;
    // Satu PO biasanya berisi beberapa produk, jadi PO Number dan Pabrik dibawa
    // dari entri sebelumnya; produk/qty/harga dikosongkan.
    setForm(
      previous
        ? {
            ...emptyPoForm(),
            poNumber: previous.poNumber,
            // Tanggal PO tidak dibawa dari entri sebelumnya: kiriman berikutnya
            // punya tanggalnya sendiri, dan default-nya sudah waktu sekarang.
            factoryId: previous.factoryId,
            currency: previous.currency,
            ppn: previous.ppn,
            keterangan: previous.keterangan,
            // Harga tidak dibawa: produknya dikosongkan, jadi harga periode entri
            // sebelumnya belum tentu milik produk berikutnya.
          }
        : emptyPoForm()
    );
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(row: PurchaseOrder) {
    setForm({
      poNumber: row.poNumber,
      poDate: row.poDate ?? "",
      productId: String(row.productId),
      factoryId: String(row.factoryId),
      quantity: String(row.quantity),
      pricePerPcs: String(row.pricePerPcs ?? 0),
      currency: (row.currency as PoForm["currency"]) ?? "Rp",
      ppn: (row.ppn as PoForm["ppn"]) ?? "Non PPN",
      keterangan:
        (row.keterangan as PoForm["keterangan"]) ?? DEFAULT_KETERANGAN,
      productPriceId: row.productPriceId ? String(row.productPriceId) : "",
    });
    setEditingId(row.id);
    setDialogOpen(true);
  }

  async function handleSubmit(mode: "save" | "saveAndAddAnother" = "save") {
    const payload = {
      poNumber: form.poNumber.trim(),
      // Tanggal PO dari operator; server menyimpannya sebagai `poDate`.
      poDate: form.poDate,
      productId: Number(form.productId),
      factoryId: Number(form.factoryId),
      quantity: Number(form.quantity) || 0,
      pricePerPcs: Number(form.pricePerPcs) || 0,
      currency: form.currency,
      ppn: form.ppn,
      keterangan: form.keterangan,
      // Harga master yang dipakai untuk Value RW; null bila produk itu belum
      // punya harga di periode PO.
      productPriceId: form.productPriceId ? Number(form.productPriceId) : null,
    };
    if (!payload.poNumber || !payload.productId || !payload.factoryId) {
      toast.error(t("po.incomplete"));
      return;
    }
    if (!payload.poDate) {
      toast.error(t("po.dateRequired"));
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
            ppn: f.ppn,
            keterangan: f.keterangan,
            productPriceId: "",
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

  // Admin: checkbox + PPN + Price/pcs + Total Currency + Value RW + kolom aksi.
  const columnCount = isAdmin ? 12 : 6;

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

        {poDemoEnabled && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong className="font-semibold">Mode demo.</strong> Data di halaman ini
              contoh dan berdiri sendiri — tidak dibaca dari database, dan tombol
              tambah/ubah/hapus tidak menyimpan apa pun. Matikan dengan menghapus
              <code className="mx-1 rounded bg-amber-500/15 px-1">NEXT_PUBLIC_PO_DEMO</code>
              dari <code className="rounded bg-amber-500/15 px-1">frontend/.env</code> lalu
              restart dev server.
            </span>
          </div>
        )}
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

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">          <SummaryCard
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
              <Label>{t("po.month")}</Label>
              <Select
                value={filterMonth}
                onValueChange={(v) => {
                  setFilterMonth(String(v));
                  setPage(1);
                }}
                items={[
                  { value: "all", label: t("po.allMonths") },
                  ...MONTHS.map((m, index) => ({
                    value: String(index + 1).padStart(2, "0"),
                    label: m,
                  })),
                ]}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("po.allMonths")}</SelectItem>
                  {MONTHS.map((m, index) => (
                    <SelectItem
                      key={m}
                      value={String(index + 1).padStart(2, "0")}
                    >
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("po.year")}</Label>
              <Select
                value={filterYear}
                onValueChange={(v) => {
                  setFilterYear(String(v));
                  setPage(1);
                }}
                items={[
                  { value: "all", label: t("po.allYears") },
                  ...yearOptions,
                ]}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("po.allYears")}</SelectItem>
                  {yearOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("po.keterangan")}</Label>
              <Select
                value={filterKeterangan}
                onValueChange={(v) => {
                  setFilterKeterangan(String(v));
                  setPage(1);
                }}
                items={[
                  { value: "all", label: t("po.allKeterangan") },
                  ...keteranganOptions,
                ]}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("po.allKeterangan")}</SelectItem>
                  {keteranganOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    {/* Timestamp tepat setelah PO Number, sesuai permintaan. */}
                    <TableHead>{t("po.timestamp")}</TableHead>
                    <TableHead>{t("po.keterangan")}</TableHead>
                    <TableHead>{t("po.productName")}</TableHead>
                    <TableHead>{t("common.factory")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.quantity")}
                    </TableHead>
                    {isAdmin && (
                      <>
                        {/* PPN hanya untuk admin, sama seperti kolom harga. */}
                        <TableHead>{t("po.ppn")}</TableHead>
                        <TableHead className="text-right">
                          {t("po.pricePerPcs")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("po.totalCurrency")}
                        </TableHead>
                        {/* Value RW = Quantity × Harga master (Rupiah), terpisah
                            dari Total yang mata uangnya bisa USD/RMB. */}
                        <TableHead className="text-right">
                          {t("po.valueRw")}
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
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {row.poDate ? formatDateTime(row.poDate) : "-"}
                      </TableCell>
                      <TableCell className="max-w-32 truncate" title={row.keterangan ?? ""}>
                        {row.keterangan || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.productName ?? "-"}
                      </TableCell>
                      {/* Nama pabrik di data asli sangat panjang (mis. "NINGBO
                          BRIGHTLITE ELECTRIC CO., LTD"), dan tanpa batas lebar ia
                          mendorong kolom harga keluar layar. Dipotong dengan nama
                          lengkap tetap bisa dibaca lewat tooltip. */}
                      <TableCell
                        className="max-w-32 truncate"
                        title={row.factoryName ?? ""}
                      >
                        {row.factoryName ?? "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.quantity)}
                      </TableCell>
                      {isAdmin && (
                        <>
                          <TableCell>
                            {/* Penanda pajak; tidak ada angka rupiah, jadi cukup teks. */}
                            <span
                              className={
                                row.ppn === "PPN"
                                  ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20"
                                  : "text-xs text-muted-foreground"
                              }
                            >
                              {row.ppn ?? "Non PPN"}
                            </span>
                          </TableCell>
                          {/* Bentuk ringkas supaya kolom tidak melebar sampai header
                              terpotong. Angka penuh tetap bisa dibaca lewat tooltip,
                              dan tetap tampil penuh di form. */}
                          <TableCell
                            className="text-right tabular-nums"
                            title={formatPoCurrency(
                              row.pricePerPcs ?? 0,
                              row.currency
                            )}
                          >
                            {formatPoCurrencyCompact(
                              row.pricePerPcs ?? 0,
                              row.currency
                            )}
                          </TableCell>
                          <TableCell
                            className="text-right font-medium tabular-nums"
                            title={formatPoCurrency(row.value ?? 0, row.currency)}
                          >
                            {formatPoCurrencyCompact(
                              row.value ?? 0,
                              row.currency
                            )}
                          </TableCell>
                          {/* Value RW: selalu Rupiah, dari harga master × quantity.
                              "-" berarti produk itu belum punya harga di periode PO. */}
                          <TableCell
                            className="text-right font-medium tabular-nums"
                            title={
                              row.productPrice != null
                                ? `${formatNumber(row.quantity)} × ${formatIDR(row.productPrice)}`
                                : t("po.priceMissing")
                            }
                          >
                            {row.productPrice != null
                              ? formatIDR(row.quantity * row.productPrice)
                              : "-"}
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
            productPrices={productPrices}
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