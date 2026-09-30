"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Search } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import type { Factory, Product } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface FactoryProductsDialogProps {
  /** Pabrik yang sedang dikaitkan; null menutup dialog. */
  factory: Factory | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

/**
 * Kaitkan produk master ke satu pabrik.
 *
 * Satu produk hanya boleh terikat satu pabrik (lihat `product_factories`), jadi
 * produk yang sudah milik pabrik lain ditandai dan ikut PINDAH kalau dipilih.
 */
export function FactoryProductsDialog({
  factory,
  onOpenChange,
  onSaved,
}: FactoryProductsDialogProps) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const factoryId = factory?.id ?? null;

  useEffect(() => {
    if (factoryId === null) return;
    let aktif = true;
    (async () => {
      try {
        const [list, linked, pabrik] = await Promise.all([
          apiGet<Product[]>("/api/products"),
          apiGet<{ productIds: number[] }>(`/api/factories/${factoryId}/products`),
          apiGet<Factory[]>("/api/factories"),
        ]);
        if (!aktif) return;
        setProducts(list);
        setSelected(new Set(linked.productIds));
        setFactories(pabrik);
        setSearch("");
        setNewName("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      aktif = false;
    };
  }, [factoryId]);

  const namaPabrik = useMemo(
    () => new Map(factories.map((f) => [f.id, f.name])),
    [factories]
  );

  const tersaring = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function tambahProduk() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const created = await apiPost<Product>("/api/products", { name });
      setProducts((list) => [...list, created]);
      setSelected((prev) => new Set(prev).add(created.id));
      setNewName("");
      setSearch("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function simpan() {
    if (factoryId === null || busy) return;
    setBusy(true);
    try {
      await apiPost(`/api/factories/${factoryId}/products`, {
        productIds: [...selected],
      });
      toast.success(t("factoryProducts.saved"));
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={factory !== null} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("factoryProducts.title")} — {factory?.name ?? ""}
          </DialogTitle>
          <DialogDescription>{t("factoryProducts.hint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("factoryProducts.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder={t("factoryProducts.newProduct")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  tambahProduk();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || newName.trim() === ""}
              onClick={tambahProduk}
            >
              <Plus className="size-4" />
              {t("common.add")}
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {tersaring.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("factoryProducts.none")}
              </p>
            ) : (
              tersaring.map((p) => {
                const dipilih = selected.has(p.id);
                const pabrikLain =
                  p.factoryId && p.factoryId !== factoryId
                    ? namaPabrik.get(p.factoryId)
                    : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                        dipilih ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {dipilih && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.sku && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.sku}
                      </span>
                    )}
                    {pabrikLain && (
                      <Badge variant="outline" className="shrink-0">
                        {t("factoryProducts.otherFactory")}: {pabrikLain}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {selected.size} {t("factoryProducts.selected")}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={busy} onClick={simpan}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
