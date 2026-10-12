"use client";

import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatIDR, formatNumber } from "@/lib/format";
import { Camera, Check, Package } from "lucide-react";
import type { Repair } from "@/lib/types";

const STATUS_KEYS: Record<string, TranslationKey> = {
  "Done Repair": "repair.status.doneRepair",
  Proses: "repair.status.proses",
  "Belum Di Buka": "repair.status.belumDibuka",
  "Tidak Ada Data": "repair.status.tidakAdaData",
  "Done Kirim": "repair.status.doneKirim",
};

const ORIGIN_KEYS: Record<string, TranslationKey> = {
  Distri: "repair.origin.distri",
  OR: "repair.origin.or",
  Customer: "repair.origin.customer",
};

const RESOLUTION_KEYS: Record<string, TranslationKey> = {
  "Replacement BJ": "repair.resolution.replacementBj",
  "Ganti Sparepart": "repair.resolution.gantiSparepart",
  Maintenance: "repair.resolution.maintenance",
  "Ganti Komponen": "repair.resolution.gantiKomponen",
  "Replacement Produk Baru": "repair.resolution.replacementProdukBaru",
};

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children || "-"}</dd>
    </div>
  );
}

export function RepairDetailDialog({
  repair,
  onOpenChange,
  spareParts,
}: {
  repair: Repair | null;
  onOpenChange: (open: boolean) => void;
  spareParts: { id: number; name: string }[];
}) {
  const { t } = useLanguage();
  // Tiap slot: pakai teks apa adanya dari sheet kalau ada; kalau kosong baru
  // turunkan nama dari id master. Nama sparepart tidak boleh hilang.
  const partNames = [
    { id: repair?.sparePart1Id, text: repair?.sparePart1Text },
    { id: repair?.sparePart2Id, text: repair?.sparePart2Text },
    { id: repair?.sparePart3Id, text: repair?.sparePart3Text },
  ]
    .map((slot) => {
      const text = (slot.text ?? "").trim();
      if (text !== "") return text;
      const id =
        typeof slot.id === "number" && slot.id > 0 ? slot.id : null;
      if (id === null) return "";
      return spareParts.find((s) => s.id === id)?.name ?? `#${id}`;
    })
    .filter((name) => name !== "");

  return (
    <Dialog
      open={repair !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("repair.detailTitle")}</DialogTitle>
          <DialogDescription className="font-mono">
            {repair?.claimId ?? "-"}
          </DialogDescription>
        </DialogHeader>
        {repair && (
          <dl className="grid max-h-[60vh] grid-cols-1 gap-x-4 gap-y-3 overflow-y-auto text-sm sm:grid-cols-2">
            <Field label={t("repair.table.claim")}>
              <span className="font-mono text-xs">{repair.claimId}</span>
            </Field>
            <Field label={t("repair.table.date")}>
              {repair.date} · {repair.month}
            </Field>
            <Field label={t("common.product")}>
              <span className="font-medium">{repair.productName ?? "-"}</span>
            </Field>
            <Field label={t("common.quantity")}>
              <span className="tabular-nums">{formatNumber(repair.quantity)}</span>
            </Field>
            <Field label={t("common.valueIdr")}>
              <span className="tabular-nums font-medium">
                {formatIDR(repair.value)}
              </span>
            </Field>
            <Field label={t("repair.form.priceType")}>
              {repair.priceType || "-"}
            </Field>
            <Field label={t("repair.form.origin")}>
              {ORIGIN_KEYS[repair.origin]
                ? t(ORIGIN_KEYS[repair.origin])
                : repair.origin || "-"}
            </Field>
            <Field label={t("common.status")}>
              <Badge variant="secondary">
                {STATUS_KEYS[repair.status]
                  ? t(STATUS_KEYS[repair.status])
                  : repair.status || "-"}
              </Badge>
            </Field>
            <Field label={t("repair.form.customerName")}>
              {repair.customerName}
            </Field>
            <Field label={t("repair.form.customerPhone")}>
              {repair.customerPhone}
            </Field>
            <Field label={t("repair.table.resi")}>{repair.resi}</Field>
            <Field label={t("repair.form.pic")}>{repair.pic}</Field>
            <Field label={t("repair.form.start")}>
              {repair.startAt ? formatDateTime(repair.startAt) : "-"}
            </Field>
            <Field label={t("repair.form.finish")}>
              {repair.finishAt ? formatDateTime(repair.finishAt) : "-"}
            </Field>
            <Field label={t("repair.form.problem")}>
              {repair.problemName ?? "-"}
            </Field>
            <Field label={t("repair.form.resolution")}>
              {RESOLUTION_KEYS[repair.resolution]
                ? t(RESOLUTION_KEYS[repair.resolution])
                : repair.resolution || "-"}
            </Field>
            <Field label={t("repair.form.sparePart", { n: "1/2/3" })} wide>
              {partNames.length > 0 ? partNames.join(", ") : "-"}
            </Field>
            <Field label={t("repair.form.customerIssue")} wide>
              <span className="whitespace-pre-wrap">
                {repair.customerIssue || "-"}
              </span>
            </Field>
            <Field label={t("repair.form.note")} wide>
              <span className="whitespace-pre-wrap">{repair.note || "-"}</span>
            </Field>
            <Field label={t("repair.form.noteClosing")} wide>
              <span className="whitespace-pre-wrap">
                {repair.noteClosing || "-"}
              </span>
            </Field>
            <Field label={t("common.media")} wide>
              <span className="flex flex-wrap gap-3">
                {repair.photoPackageLink ? (
                  <a
                    href={repair.photoPackageLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    <Package className="size-4" /> {t("common.photoPackage")}
                  </a>
                ) : null}
                {repair.photoCompletenessLink ? (
                  <a
                    href={repair.photoCompletenessLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    <Camera className="size-4" />{" "}
                    {t("repair.form.photoCompleteness")}
                  </a>
                ) : null}
                {!repair.photoPackageLink && !repair.photoCompletenessLink && (
                  <span className="text-muted-foreground">-</span>
                )}
              </span>
            </Field>
            {repair.sheetSyncedAt && (
              <Field label={t("repair.syncedAt")} wide>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="size-3.5" />
                  {formatDateTime(repair.sheetSyncedAt)}
                </span>
              </Field>
            )}
          </dl>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
