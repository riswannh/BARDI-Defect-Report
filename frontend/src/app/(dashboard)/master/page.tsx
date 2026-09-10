"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiDelete, apiPatch, apiPost, apiUpload, downloadUrl } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type { Problem, Product, Status } from "@/lib/types";
import { MasterList } from "@/components/master-list";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, FileDown, Upload } from "lucide-react";

interface ImportSummary {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export default function MasterPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("products");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: productData, reload: reloadProducts } =
    useApi<Product[]>("/api/products");
  const { data: problemData, reload: reloadProblems } =
    useApi<Problem[]>("/api/problems");
  const { data: statusData, reload: reloadStatuses } =
    useApi<Status[]>("/api/statuses");

  const products = productData ?? [];
  const problems = problemData ?? [];
  const statuses = statusData ?? [];

  async function addItem(endpoint: string, name: string, reload: () => void) {
    try {
      await apiPost(endpoint, { name });
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah.");
    }
  }

  async function renameItem(
    endpoint: string,
    id: number,
    name: string,
    reload: () => void
  ) {
    try {
      await apiPatch(`${endpoint}/${id}`, { name });
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
      const result = await apiUpload<ImportSummary>(
        `/api/excel/${tab}/import`,
        file
      );
      toast.success(
        `Import selesai: ${result.inserted} masuk, ${result.skipped} dilewati.`
      );
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} baris bermasalah.`);
      }
      if (tab === "products") reloadProducts();
      if (tab === "problems") reloadProblems();
      if (tab === "statuses") reloadStatuses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal import.");
    }
    e.target.value = "";
  }

  return (
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
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="products">{t("common.product")}</TabsTrigger>
          <TabsTrigger value="problems">{t("common.problem")}</TabsTrigger>
          <TabsTrigger value="statuses">{t("common.status")}</TabsTrigger>
        </TabsList>

        <Card size="sm" className="mt-4">
          <CardContent className="pt-4">
            <TabsContent value="products">
              <MasterList
                items={products}
                addPlaceholder={t("master.newProduct")}
                onAdd={(name) => addItem("/api/products", name, reloadProducts)}
                onRename={(id, name) =>
                  renameItem("/api/products", id, name, reloadProducts)
                }
                onDelete={(id) =>
                  deleteItem("/api/products", id, reloadProducts)
                }
              />
            </TabsContent>
            <TabsContent value="problems">
              <MasterList
                items={problems}
                addPlaceholder={t("master.newProblem")}
                onAdd={(name) => addItem("/api/problems", name, reloadProblems)}
                onRename={(id, name) =>
                  renameItem("/api/problems", id, name, reloadProblems)
                }
                onDelete={(id) =>
                  deleteItem("/api/problems", id, reloadProblems)
                }
              />
            </TabsContent>
            <TabsContent value="statuses">
              <MasterList
                items={statuses}
                addPlaceholder={t("master.newStatus")}
                onAdd={(name) => addItem("/api/statuses", name, reloadStatuses)}
                onRename={(id, name) =>
                  renameItem("/api/statuses", id, name, reloadStatuses)
                }
                onDelete={(id) =>
                  deleteItem("/api/statuses", id, reloadStatuses)
                }
              />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
