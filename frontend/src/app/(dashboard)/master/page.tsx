"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiDelete, apiPatch, apiPost, apiUpload, downloadUrl } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type {
  ImportResult,
  Keterangan,
  Problem,
  Product,
  Status,
} from "@/lib/types";import { AdminGuard } from "@/components/admin-guard";
import { DeleteAllDialog } from "@/components/delete-all-dialog";
import { ImportResultDialog } from "@/components/import-result-dialog";
import { MasterList } from "@/components/master-list";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
  const { data: keteranganData, reload: reloadKeterangan } =
    useApi<Keterangan[]>("/api/keterangan");

  const products = productData ?? [];
  const problems = problemData ?? [];
  const statuses = statusData ?? [];
  const keteranganList = keteranganData ?? [];

  const [pageSize, setPageSize] = useState(10);
  const [pageState, setPageState] = useState({ signature: tab, page: 1 });
  const page = pageState.signature === tab ? pageState.page : 1;
  const setPage = (next: number) =>
    setPageState({ signature: tab, page: next });

  const activeItems =
    tab === "products"
      ? products
      : tab === "problems"
        ? problems
        : tab === "keterangan"
          ? keteranganList
          : statuses;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pagedProducts = products.slice(start, end);
  const pagedProblems = problems.slice(start, end);
  const pagedStatuses = statuses.slice(start, end);
  const pagedKeterangan = keteranganList.slice(start, end);

  async function addItem(
    endpoint: string,
    name: string,
    reload: () => void,
    sku?: string
  ) {
    try {
      await apiPost(endpoint, sku === undefined ? { name } : { name, sku });
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah.");
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah.");
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
      if (tab === "keterangan") reloadKeterangan();
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
        : tab === "keterangan"
          ? t("po.keterangan")
          : t("common.status");

  async function handleDeleteAll() {
    try {
      const res = await apiDelete<{ deleted: number }>(`/api/${tab}`);
      toast.success(t("deleteAll.success", { count: res.deleted }));
      setDeleteAllOpen(false);
      if (tab === "products") reloadProducts();
      if (tab === "problems") reloadProblems();
      if (tab === "statuses") reloadStatuses();
      if (tab === "keterangan") reloadKeterangan();
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
          <TabsTrigger value="problems">{t("common.problem")}</TabsTrigger>
          <TabsTrigger value="keterangan">{t("po.keterangan")}</TabsTrigger>
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
            <TabsContent value="keterangan">
              <MasterList
                items={pagedKeterangan}
                addPlaceholder={t("master.newKeterangan")}
                onAdd={(name) =>
                  addItem("/api/keterangan", name, reloadKeterangan)
                }
                onRename={(id, name) =>
                  renameItem("/api/keterangan", id, name, reloadKeterangan)
                }
                onDelete={(id) =>
                  deleteItem("/api/keterangan", id, reloadKeterangan)
                }
              />
              {keteranganList.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    totalItems={keteranganList.length}
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
