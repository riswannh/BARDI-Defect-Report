"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Search } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import type { SparePart } from "@/lib/types";
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

interface ProductSparePartsDialogProps {
  /** Produk yang sedang dikaitkan; null menutup dialog. Cukup id + nama. */
  product: { id: number; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

/**
 * Kaitkan sparepart master ke satu produk.
 *
 * Beda dari `FactoryProductsDialog`: kaitannya banyak-ke-banyak
 * (`product_spare_parts`), jadi sparepart yang sudah dipakai produk lain tetap
 * boleh dipilih dan TIDAK pindah. Produk pemakai tidak ditandai di sini —
 * daftarnya dilihat dari tab Sparepart (`SparePartProductsDialog`).
 */
export function ProductSparePartsDialog({
  product,
  onOpenChange,
  onSaved,
}: ProductSparePartsDialogProps) {
  const { t } = useLanguage();
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const productId = product?.id ?? null;
  const productName = product?.name ?? "";

  useEffect(() => {
    if (productId === null) return;
    let aktif = true;
    (async () => {
      try {
        const [list, linked] = await Promise.all([
          apiGet<SparePart[]>("/api/spare-parts"),
          apiGet<{ sparePartIds: number[] }>(
            `/api/products/${productId}/spare-parts`
          ),
        ]);
        if (!aktif) return;
        setSpareParts(list);
        setSelected(new Set(linked.sparePartIds));
        setSearch("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      aktif = false;
    };
  }, [productId]);

  const tersaring = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return spareParts;
    return spareParts.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.sku ?? "").toLowerCase().includes(q)
    );
  }, [spareParts, search]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function simpan() {
    if (productId === null || busy) return;
    setBusy(true);
    try {
      await apiPost(`/api/products/${productId}/spare-parts`, {
        sparePartIds: [...selected],
      });
      toast.success(t("productSpareParts.saved"));
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("productSpareParts.title")} — {productName}
          </DialogTitle>
          <DialogDescription>{t("productSpareParts.hint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("productSpareParts.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {tersaring.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("productSpareParts.none")}
              </p>
            ) : (
              tersaring.map((item) => {
                const dipilih = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                        dipilih ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {dipilih && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {item.sku && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.sku}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {selected.size} {t("productSpareParts.selected")}
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
