"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { MasterList } from "@/components/master-list";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  problems as initialProblems,
  products as initialProducts,
  statuses as initialStatuses,
} from "@/lib/mock-data";
import type { Problem, Product, Status } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";

export default function MasterPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [problems, setProblems] = useState<Problem[]>(initialProblems);
  const [statuses, setStatuses] = useState<Status[]>(initialStatuses);

  function nextId(list: { id: number }[]): number {
    return Math.max(0, ...list.map((i) => i.id)) + 1;
  }

  return (
    <div>
      <PageHeader
        title={t("master.title")}
        description={t("master.description")}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload className="size-4" /> {t("common.importExcel")}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> {t("common.exportExcel")}
            </Button>
          </>
        }
      />

      <Tabs defaultValue="products" className="w-full">
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
                onAdd={(name) =>
                  setProducts((prev) => [...prev, { id: nextId(prev), name }])
                }
                onRename={(id, name) =>
                  setProducts((prev) =>
                    prev.map((p) => (p.id === id ? { ...p, name } : p))
                  )
                }
                onDelete={(id) =>
                  setProducts((prev) => prev.filter((p) => p.id !== id))
                }
              />
            </TabsContent>
            <TabsContent value="problems">
              <MasterList
                items={problems}
                addPlaceholder={t("master.newProblem")}
                onAdd={(name) =>
                  setProblems((prev) => [...prev, { id: nextId(prev), name }])
                }
                onRename={(id, name) =>
                  setProblems((prev) =>
                    prev.map((p) => (p.id === id ? { ...p, name } : p))
                  )
                }
                onDelete={(id) =>
                  setProblems((prev) => prev.filter((p) => p.id !== id))
                }
              />
            </TabsContent>
            <TabsContent value="statuses">
              <MasterList
                items={statuses}
                addPlaceholder={t("master.newStatus")}
                onAdd={(name) =>
                  setStatuses((prev) => [...prev, { id: nextId(prev), name }])
                }
                onRename={(id, name) =>
                  setStatuses((prev) =>
                    prev.map((p) => (p.id === id ? { ...p, name } : p))
                  )
                }
                onDelete={(id) =>
                  setStatuses((prev) => prev.filter((p) => p.id !== id))
                }
              />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
