"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiDelete, apiPatch, apiPost, apiUpload, downloadUrl } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type {
  ImportResult,
  Problem,
  Product,
  ProductPrice,
  Status,
} from "@/lib/types";
import { MONTHS_FULL } from "@/lib/format";
import { PRICE_MONTHS } from "@/lib/api/validation";
import { AdminGuard } from "@/components/admin-guard";
import { DeleteAllDialog } from "@/components/delete-all-dialog";
import { ImportResultDialog } from "@/components/import-result-dialog";
import { MasterList } from "@/components/master-list";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { PriceList } from "@/components/price-list";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileDown, History, Trash2, Upload } from "lucide-react";

export default function MasterPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("products");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: productData, reload: reloadProducts } =
    useApi<Product[]>("/api/products");
  const { data: problemData, reload: reloadProblems } =
    useApi<Problem[]>("/api/problems");
  const { data: statusData, reload: reloadStatuses } =
    useApi<Status[]>("/api/statuses");
  const { data: priceData, reload: reloadPrices } =
    useApi<ProductPrice[]>("/api/product-prices");

  const products = productData ?? [];
  const problems = problemData ?? [];
  const statuses = statusData ?? [];
  const prices = priceData ?? [];

  // Filter tab Harga Produk. Pilihan bulan & tahun diambil dari data yang ada,
  // jadi tidak ada periode kosong yang bisa dipilih.
  const [priceSearch, setPriceSearch] = useState("");
  const [priceMonth, setPriceMonth] = useState("all");
  const [priceYear, setPriceYear] = useState("all");
  const priceFilterActive =
    priceSearch.trim() !== "" || priceMonth !== "all" || priceYear !== "all";

  const filteredPrices = prices.filter((item) => {
    if (priceMonth !== "all" && item.month !== priceMonth) return false;
    if (priceYear !== "all" && item.year !== priceYear) return false;
    const q = priceSearch.trim().toLowerCase();
    if (!q) return true;
    const product = products.find((p) => p.id === item.productId);
    const name = item.productName ?? product?.name ?? "";
    const sku = item.sku ?? product?.sku ?? "";
    return `${name} ${sku}`.toLowerCase().includes(q);
  });

  const priceMonthOptions = [
    { value: "all", label: t("price.allMonths") },
    ...[...new Set(prices.map((item) => item.month))].sort().map((value) => ({
      value,
      label:
        MONTHS_FULL[
          PRICE_MONTHS.indexOf(value as (typeof PRICE_MONTHS)[number])
        ] ?? value,
    })),
  ];
  const priceYearOptions = [
    { value: "all", label: t("price.allYears") },
    ...[...new Set(prices.map((item) => item.year))]
      .sort()
      .reverse()
      .map((value) => ({ value, label: value })),
  ];

  const [pageSize, setPageSize] = useState(10);
  const [pageState, setPageState] = useState({ signature: tab, page: 1 });
  const page = pageState.signature === tab ? pageState.page : 1;
  const setPage = (next: number) =>
    setPageState({ signature: tab, page: next });

  // Daftar yang sedang tampil menentukan jumlah halaman. Tab "prices" WAJIB ikut
  // di sini: dulu dia jatuh ke `statuses` (cuma 1 baris di produksi), sehingga
  // totalPages selalu 1 dan tombol "Berikutnya" tidak pernah bisa pindah.
  const activeItems =
    tab === "products"
      ? products
      : tab === "problems"
        ? problems
        : tab === "prices"
          ? filteredPrices
          : statuses;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pagedProducts = products.slice(start, end);
  const pagedProblems = problems.slice(start, end);
  const pagedStatuses = statuses.slice(start, end);
  const pagedPrices = filteredPrices.slice(start, end);

  async function addItem(
    endpoint: string,
    name: string,
    reload: () => void,
    sku?: string
  ) {
    try {
      await apiPost(endpoint, sku === undefined ? { name } : { name, sku });
      reload();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah.");
      return false;
    }
  }

  async function renameItem(
    endpoint: string,
    id: number,
    name: string,
    reload: () => void,
    sku?: string
  ) {
    try {
      await apiPatch(
        `${endpoint}/${id}`,
        sku === undefined ? { name } : { name, sku }
      );
      reload();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah.");
      return false;
    }
  }

  async function deleteItem(endpoint: string, id: number, reload: () => void) {
    try {
      await apiDelete(`${endpoint}/${id}`);
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
        `/api/excel/${tab}/import`,
        file
      );
      setImportResult(result);
      setImportDialogOpen(true);
      toast.success(
        `Import selesai: ${result.inserted} masuk, ${result.skipped} dilewati, ${result.errors.length} gagal.`
      );
      if (tab === "products") reloadProducts();
      if (tab === "problems") reloadProblems();
      if (tab === "statuses") reloadStatuses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal import.");
    }
    e.target.value = "";
  }

  const tabLabel =
    tab === "products"
      ? t("common.product")
      : tab === "problems"
        ? t("common.problem")
        : tab === "prices"
          ? t("price.tab")
          : t("common.status");

  // Harga produk: satu baris = produk + nominal + periode, jadi handler-nya
  // terpisah dari master yang hanya nama.
  async function addPrice(input: {
    productId: number;
    price: number;
    month: string;
    year: string;
  }) {
    try {
      await apiPost("/api/product-prices", input);
      reloadPrices();
      toast.success(t("price.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan harga.");
    }
  }

  async function updatePrice(
    id: number,
    input: { productId: number; price: number; month: string; year: string }
  ) {
    try {
      await apiPatch(`/api/product-prices/${id}`, input);
      reloadPrices();
      toast.success(t("price.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan harga.");
    }
  }

  async function deletePrice(id: number) {
    try {
      await apiDelete(`/api/product-prices/${id}`);
      reloadPrices();
      toast.success(t("price.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus harga.");
    }
  }

  /** Salin semua harga dari periode sebelumnya ke periode yang dipilih di form. */
  async function carryForwardPrices(input: { month: string; year: string }) {
    try {
      const res = await apiPost<{ inserted: number; skipped: number; message: string }>(
        "/api/product-prices/carry-forward",
        input
      );
      reloadPrices();
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyalin harga.");
    }
  }

  async function handleDeleteAll() {
    try {
      const res = await apiDelete<{ deleted: number }>(`/api/${tab}`);
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setDeleteAllOpen(false);
      if (tab === "products") reloadProducts();
      if (tab === "problems") reloadProblems();
      if (tab === "statuses") reloadStatuses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  return (
    <AdminGuard>
      <div>
      <PageHeader
        title={t("master.title")}
        description={t("master.description")}
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
              onClick={() => downloadUrl(`/api/excel/${tab}/template`)}
              disabled={tab === "prices"}
            >
              <FileDown className="size-4" /> {t("common.template")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={tab === "prices"}
            >
              <Upload className="size-4" /> {t("common.importExcel")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadUrl(`/api/excel/${tab}/export`)}
              disabled={tab === "prices"}
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
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="products">{t("common.product")}</TabsTrigger>
          <TabsTrigger value="problems">{t("common.problem")}</TabsTrigger>
          <TabsTrigger value="prices">{t("price.tab")}</TabsTrigger>
          <TabsTrigger value="statuses">{t("common.status")}</TabsTrigger>
        </TabsList>

        <Card size="sm" className="mt-4">
          <CardContent className="pt-4">
            <TabsContent value="products">
              <MasterList
                items={pagedProducts}
                withSku
                addPlaceholder={t("master.newProduct")}
                onAdd={(name, sku) =>
                  addItem("/api/products", name, reloadProducts, sku)
                }
                onRename={(id, name, sku) =>
                  renameItem("/api/products", id, name, reloadProducts, sku)
                }
                onDelete={(id) =>
                  deleteItem("/api/products", id, reloadProducts)
                }
              />
              {products.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={products.length}
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
            </TabsContent>
            <TabsContent value="problems">
              <MasterList
                items={pagedProblems}
                addPlaceholder={t("master.newProblem")}
                onAdd={(name) => addItem("/api/problems", name, reloadProblems)}
                onRename={(id, name) =>
                  renameItem("/api/problems", id, name, reloadProblems)
                }
                onDelete={(id) =>
                  deleteItem("/api/problems", id, reloadProblems)
                }
              />
              {problems.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={problems.length}
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
            </TabsContent>
            <TabsContent value="prices">
              <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border p-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="price-filter-search">{t("common.search")}</Label>
                  <Input
                    id="price-filter-search"
                    value={priceSearch}
                    onChange={(e) => {
                      setPriceSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder={t("price.searchPlaceholder")}
                    className="w-64"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("price.month")}</Label>
                  <Select
                    value={priceMonth}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setPriceMonth(String(value));
                      setPage(1);
                    }}
                    items={priceMonthOptions}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priceMonthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("price.year")}</Label>
                  <Select
                    value={priceYear}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setPriceYear(String(value));
                      setPage(1);
                    }}
                    items={priceYearOptions}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priceYearOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <PriceList
                items={pagedPrices}
                products={products}
                onAdd={addPrice}
                onUpdate={updatePrice}
                onDelete={deletePrice}
                onCarryForward={carryForwardPrices}
                emptyLabel={
                  priceFilterActive ? t("price.emptyFiltered") : undefined
                }
              />
              {filteredPrices.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={filteredPrices.length}
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
            </TabsContent>
            <TabsContent value="statuses">
              <MasterList
                items={pagedStatuses}
                addPlaceholder={t("master.newStatus")}
                onAdd={(name) => addItem("/api/statuses", name, reloadStatuses)}
                onRename={(id, name) =>
                  renameItem("/api/statuses", id, name, reloadStatuses)
                }
                onDelete={(id) =>
                  deleteItem("/api/statuses", id, reloadStatuses)
                }
              />
              {statuses.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={statuses.length}
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
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <ImportResultDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        result={importResult}
      />

      <DeleteAllDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        label={tabLabel}
        onConfirm={handleDeleteAll}
      />
      </div>
    </AdminGuard>
  );
}
