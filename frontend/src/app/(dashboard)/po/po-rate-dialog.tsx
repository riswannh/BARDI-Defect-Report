"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiPatch } from "@/lib/api-client";
import type { CurrencyRates } from "@/lib/types";
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
import { Label } from "@/components/ui/label";

interface PoRateDialogProps {
  rates: CurrencyRates;
  onClose: () => void;
  /** Dipanggil setelah server menyimpan kurs baru. */
  onSaved: () => void;
}

/**
 * Menu "Atur kurs" dari kartu Total Value PO: berapa Rupiah untuk 1 USD dan
 * 1 RMB. Komponen ini selalu di-mount dalam keadaan terbuka (induk yang
 * mengatur tampil/tidaknya), jadi nilai awal form cukup diambil sekali di
 * `useState` — tanpa efek yang menyetel ulang state.
 */
export function PoRateDialog({ rates, onClose, onSaved }: PoRateDialogProps) {
  const { t } = useLanguage();
  const [usd, setUsd] = useState(rates.usd > 0 ? String(rates.usd) : "");
  const [rmb, setRmb] = useState(rates.rmb > 0 ? String(rates.rmb) : "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const usdValue = Number(usd);
    const rmbValue = Number(rmb);
    if (
      !Number.isFinite(usdValue) ||
      !Number.isFinite(rmbValue) ||
      usdValue < 0 ||
      rmbValue < 0
    ) {
      toast.error(t("po.rate.invalid"));
      return;
    }

    setSaving(true);
    try {
      await apiPatch<CurrencyRates>("/api/currency-rates", {
        usd: usdValue,
        rmb: rmbValue,
      });
      toast.success(t("po.rate.saved"));
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("po.rate.invalid"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("po.rate.title")}</DialogTitle>
          <DialogDescription>{t("po.rate.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rate-usd">{t("po.rate.usd")}</Label>
            <Input
              id="rate-usd"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={usd}
              onChange={(event) => setUsd(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rate-rmb">{t("po.rate.rmb")}</Label>
            <Input
              id="rate-rmb"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={rmb}
              onChange={(event) => setRmb(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
