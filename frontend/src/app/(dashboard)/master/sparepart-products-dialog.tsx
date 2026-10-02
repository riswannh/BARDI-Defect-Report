"use client";

import { useLanguage } from "@/lib/i18n";
import type { SparePart } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SparePartProductsDialogProps {
  /** Sparepart yang sedang dilihat; null menutup dialog. */
  sparePart: SparePart | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Daftar produk yang memakai satu sparepart.
 *
 * `productNames` sudah ikut di `GET /api/spare-parts`, jadi tidak ada fetch
 * tambahan di sini.
 */
export function SparePartProductsDialog({
  sparePart,
  onOpenChange,
}: SparePartProductsDialogProps) {
  const { t } = useLanguage();
  const names = sparePart?.productNames ?? [];

  return (
    <Dialog open={sparePart !== null} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("sparePartProducts.title")} — {sparePart?.name ?? ""}
          </DialogTitle>
          <DialogDescription>{t("sparePartProducts.hint")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded-lg border">
          {names.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("sparePartProducts.none")}
            </p>
          ) : (
            names.map((name) => (
              <div
                key={name}
                className="border-b px-3 py-2 text-sm last:border-b-0"
              >
                {name}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
