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
  SparePart,
  Status,
} from "@/lib/types";
import { MONTHS_FULL } from "@/lib/format";
import {
  DEFAULT_PRICE_TYPE,
  PRICE_MONTHS,
  PRICE_TYPES,
} from "@/lib/api/validation";
import { AdminGuard } from "@/components/admin-guard";
import { DeleteAllDialog } from "@/components/delete-all-dialog";
import { ImportResultDialog } from "@/components/import-result-dialog";
import { MasterList } from "@/components/master-list";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import {
  PriceList,
  type PriceInput,
  type PriceRow,
} from "@/components/price-list";
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
import { Boxes, Download, FileDown, History, Trash2, Upload, Wrench } from "lucide-react";
import { ProductSparePartsDialog } from "./product-spare-parts-dialog";
import { SparePartProductsDialog } from "./sparepart-products-dialog";
import { SparePartPricesTab } from "./sparepart-prices-tab";

/**
 * Endpoint "hapus semua" per tab. Nama tab tidak selalu sama dengan nama
 * endpoint — dulu `/api/${tab}` membuat tab Harga Produk menembak `/api/prices`
 * yang tidak ada (404).
 */
const DELETE_ALL_ENDPOINTS: Record<string, string> = {
  products: "/api/products",
  problems: "/api/problems",
  statuses: "/api/statuses",
  prices: "/api/product-prices",
  spareparts: "/api/spare-parts",
  "sparepart-prices": "/api/spare-part-prices",
};

/**
 * Kotak pencarian untuk tab Produk/Problem/Status. Penyaringannya dilakukan di
 * `MasterPage` karena paging ikut dihitung di sana.
 */
function SearchBox({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{t("common.search")}</Label>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-64"
        />
      </div>
    </div>
  );
}

export default function MasterPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("products");
  /** Dinaikkan setelah impor Excel supaya tab harga sparepart memuat ulang. */
  const [sparePartPriceVersion, setSparePartPriceVersion] = useState(0);
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
  const { data: sparePartData, reload: reloadSpareParts } =
    useApi<SparePart[]>("/api/spare-parts");

  const products = productData ?? [];
  const problems = problemData ?? [];
  const statuses = statusData ?? [];
  const prices = priceData ?? [];
  const spareParts = sparePartData ?? [];
  const [linkProduct, setLinkProduct] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [linkSparePart, setLinkSparePart] = useState<SparePart | null>(null);

  // Pencarian tab Produk/Problem/Status. Penyaringan ada di halaman ini karena
  // paging juga dihitung di sini — jumlah halaman harus ikut hasil pencarian.
  const [productSearch, setProductSearch] = useState("");
  const [problemSearch, setProblemSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");
  const [sparePartSearch, setSparePartSearch] = useState("");

  const matchSearch = (query: string, ...fields: (string | null | undefined)[]) => {
    const q = query.trim().toLowerCase();
    return !q || fields.some((field) => (field ?? "").toLowerCase().includes(q));
  };
  const filteredProducts = products.filter((item) =>
    matchSearch(productSearch, item.name, item.sku)
  );
  const filteredProblems = problems.filter((item) =>
    matchSearch(problemSearch, item.name)
  );
  const filteredStatuses = statuses.filter((item) =>
    matchSearch(statusSearch, item.name)
  );
  const filteredSpareParts = spareParts.filter((item) =>
    matchSearch(sparePartSearch, item.name, item.sku)
  );

  // Filter tab Harga Produk. Pilihan bulan & tahun diambil dari data yang ada,
  // jadi tidak ada periode kosong yang bisa dipilih.
  const [priceSearch, setPriceSearch] = useState("");
  const [priceMonth, setPriceMonth] = useState("all");
  const [priceYear, setPriceYear] = useState("all");
  const [priceType, setPriceType] = useState("all");
  const priceFilterActive =
    priceSearch.trim() !== "" ||
    priceMonth !== "all" ||
    priceYear !== "all" ||
    priceType !== "all";

  const filteredPrices = prices.filter((item) => {
    if (priceMonth !== "all" && item.month !== priceMonth) return false;
    if (priceYear !== "all" && item.year !== priceYear) return false;
    if (
      priceType !== "all" &&
      (item.priceType ?? DEFAULT_PRICE_TYPE) !== priceType
    ) {
      return false;
    }
    const q = priceSearch.trim().toLowerCase();
    if (!q) return true;
    const product = products.find((p) => p.id === item.productId);
    const name = item.productName ?? product?.name ?? "";
    const sku = item.sku ?? product?.sku ?? "";
    return `${name} ${sku}`.toLowerCase().includes(q);
  });

  // Jenis harga tetap daftarnya (PRICE_TYPES), bukan dari data, supaya jenis yang
  // belum punya harga tetap bisa dipilih/difilter.
  const priceTypeOptions = [
    { value: "all", label: t("price.allTypes") },
    ...PRICE_TYPES.map((value) => ({ value, label: value })),
  ];

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
  // Tab "sparepart-prices" menghitung pagingnya sendiri (lihat SparePartPricesTab).
  const activeCount =
    tab === "products"
      ? filteredProducts.length
      : tab === "problems"
        ? filteredProblems.length
        : tab === "prices"
          ? filteredPrices.length
          : tab === "spareparts"
            ? filteredSpareParts.length
            : filteredStatuses.length;
  const totalPages = Math.max(1, Math.ceil(activeCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pagedProducts = filteredProducts.slice(start, end);
  const pagedProblems = filteredProblems.slice(start, end);
  const pagedStatuses = filteredStatuses.slice(start, end);
  const pagedSpareParts = filteredSpareParts.slice(start, end);
  const pagedPrices = filteredPrices.slice(start, end);
  /** `PriceList` memakai `refId`/`name` supaya bisa dipakai produk maupun sparepart. */
  const priceRows: PriceRow[] = pagedPrices.map((row) => ({
    id: row.id,
    refId: row.productId,
    price: row.price,
    priceType: row.priceType,
    month: row.month,
    year: row.year,
    sku: row.sku,
    name: row.productName,
  }));

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
      if (tab === "prices") reloadPrices();
      // Tabel harga sparepart memuat datanya sendiri di dalam tab itu.
      if (tab === "sparepart-prices") setSparePartPriceVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal import.");
    }
    e.target.value = "";
  }

  const tabLabels: Record<string, string> = {
    products: t("common.product"),
    problems: t("common.problem"),
    prices: t("price.tab"),
    statuses: t("common.status"),
    spareparts: t("sparePart.tab"),
    "sparepart-prices": t("sparePartPrice.tab"),
  };
  const tabLabel = tabLabels[tab] ?? t("common.status");

  // Harga produk: satu baris = produk + nominal + periode, jadi handler-nya
  // terpisah dari master yang hanya nama. `refId` diisi dari `productId`.
  async function addPrice(input: PriceInput) {
    try {
      await apiPost("/api/product-prices", {
        productId: input.refId,
        price: input.price,
        priceType: input.priceType,
        month: input.month,
        year: input.year,
      });
      reloadPrices();
      toast.success(t("price.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan harga.");
    }
  }

  async function updatePrice(id: number, input: PriceInput) {
    try {
      await apiPatch(`/api/product-prices/${id}`, {
        productId: input.refId,
        price: input.price,
        priceType: input.priceType,
        month: input.month,
        year: input.year,
      });
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
      const res = await apiDelete<{ deleted: number }>(
        DELETE_ALL_ENDPOINTS[tab] ?? `/api/${tab}`
      );
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setDeleteAllOpen(false);
      if (tab === "products") reloadProducts();
      if (tab === "problems") reloadProblems();
      if (tab === "statuses") reloadStatuses();
      if (tab === "spareparts") reloadSpareParts();
      if (tab === "prices") reloadPrices();
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
              onClick={() => downloadUrl(`/api/excel/${tab}/export`)}
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
          <TabsTrigger value="prices">{t("price.tab")}</TabsTrigger>
          <TabsTrigger value="spareparts">{t("sparePart.tab")}</TabsTrigger>
          <TabsTrigger value="sparepart-prices">
            {t("sparePartPrice.tab")}
          </TabsTrigger>
          <TabsTrigger value="problems">{t("common.problem")}</TabsTrigger>
          <TabsTrigger value="statuses">{t("common.status")}</TabsTrigger>
        </TabsList>

        <Card size="sm" className="mt-4">
          <CardContent className="pt-4">
            <TabsContent value="products">
              <SearchBox
                id="master-search-products"
                value={productSearch}
                onChange={(value) => {
                  setProductSearch(value);
                  setPage(1);
                }}
                placeholder={t("masterList.searchNameSku")}
              />
              <MasterList
                items={pagedProducts}
                withSku
                addPlaceholder={t("master.newProduct")}
                emptyLabel={
                  productSearch.trim() ? t("masterList.emptyFiltered") : undefined
                }
                onAdd={(name, sku) =>
                  addItem("/api/products", name, reloadProducts, sku)
                }
                onRename={(id, name, sku) =>
                  renameItem("/api/products", id, name, reloadProducts, sku)
                }
                onDelete={(id) =>
                  deleteItem("/api/products", id, reloadProducts)
                }
                onLink={(item) => setLinkProduct(item)}
                linkLabel={t("master.linkSpareParts")}
                linkIcon={Wrench}
              />
              {filteredProducts.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={filteredProducts.length}
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
              <SearchBox
                id="master-search-problems"
                value={problemSearch}
                onChange={(value) => {
                  setProblemSearch(value);
                  setPage(1);
                }}
                placeholder={t("masterList.searchName")}
              />
              <MasterList
                items={pagedProblems}
                addPlaceholder={t("master.newProblem")}
                emptyLabel={
                  problemSearch.trim() ? t("masterList.emptyFiltered") : undefined
                }
                onAdd={(name) => addItem("/api/problems", name, reloadProblems)}
                onRename={(id, name) =>
                  renameItem("/api/problems", id, name, reloadProblems)
                }
                onDelete={(id) =>
                  deleteItem("/api/problems", id, reloadProblems)
                }
              />
              {filteredProblems.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={filteredProblems.length}
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
                <div className="flex flex-col gap-1.5">
                  <Label>{t("price.type")}</Label>
                  <Select
                    value={priceType}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setPriceType(String(value));
                      setPage(1);
                    }}
                    items={priceTypeOptions}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priceTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <PriceList
                items={priceRows}
                options={products}
                priceTypes={PRICE_TYPES}
                defaultPriceType={DEFAULT_PRICE_TYPE}
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
            <TabsContent value="spareparts">
              <SearchBox
                id="master-search-spareparts"
                value={sparePartSearch}
                onChange={(value) => {
                  setSparePartSearch(value);
                  setPage(1);
                }}
                placeholder={t("masterList.searchNameSku")}
              />
              <MasterList
                items={pagedSpareParts}
                withSku
                addPlaceholder={t("master.newSparePart")}
                emptyLabel={
                  sparePartSearch.trim()
                    ? t("masterList.emptyFiltered")
                    : undefined
                }
                onAdd={(name, sku) =>
                  addItem("/api/spare-parts", name, reloadSpareParts, sku)
                }
                onRename={(id, name, sku) =>
                  renameItem("/api/spare-parts", id, name, reloadSpareParts, sku)
                }
                onDelete={(id) =>
                  deleteItem("/api/spare-parts", id, reloadSpareParts)
                }
                onLink={(item) =>
                  setLinkSparePart(
                    spareParts.find((row) => row.id === item.id) ?? null
                  )
                }
                linkLabel={t("master.linkSparePartProducts")}
                linkIcon={Boxes}
              />
              {filteredSpareParts.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={filteredSpareParts.length}
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
            <TabsContent value="sparepart-prices">
              <SparePartPricesTab reloadToken={sparePartPriceVersion} />
            </TabsContent>
            <TabsContent value="statuses">
              <SearchBox
                id="master-search-statuses"
                value={statusSearch}
                onChange={(value) => {
                  setStatusSearch(value);
                  setPage(1);
                }}
                placeholder={t("masterList.searchName")}
              />
              <MasterList
                items={pagedStatuses}
                addPlaceholder={t("master.newStatus")}
                emptyLabel={
                  statusSearch.trim() ? t("masterList.emptyFiltered") : undefined
                }
                onAdd={(name) => addItem("/api/statuses", name, reloadStatuses)}
                onRename={(id, name) =>
                  renameItem("/api/statuses", id, name, reloadStatuses)
                }
                onDelete={(id) =>
                  deleteItem("/api/statuses", id, reloadStatuses)
                }
              />
              {filteredStatuses.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={filteredStatuses.length}
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

      <ProductSparePartsDialog
        product={linkProduct}
        onOpenChange={(open) => {
          if (!open) setLinkProduct(null);
        }}
        onSaved={reloadSpareParts}
      />

      <SparePartProductsDialog
        sparePart={linkSparePart}
        onOpenChange={(open) => {
          if (!open) setLinkSparePart(null);
        }}
      />
      </div>
    </AdminGuard>
  );
}
