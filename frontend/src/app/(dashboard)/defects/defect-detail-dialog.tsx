"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatIDR, formatNumber } from "@/lib/format";
import { Camera, Pencil, Trash2, Video } from "lucide-react";
import type { DefectRow } from "./defect-form";
import type { Factory, Problem } from "@/lib/types";

export function DefectDetailDialog({
  defect,
  onOpenChange,
  productName,
  factories,
  problems,
  isAdmin,
  onEdit,
  onDelete,
}: {
  defect: DefectRow | null;
  onOpenChange: (open: boolean) => void;
  productName: string;
  factories: Factory[];
  problems: Problem[];
  isAdmin: boolean;
  /** Buka form ubah untuk defect ini (tombol pindah dari tabel ke popup). */
  onEdit?: (defect: DefectRow) => void;
  onDelete?: (defect: DefectRow) => void;
}) {
  const { language, t } = useLanguage();
  /**
   * Default bahasa Problem Detail mengikuti bahasa aplikasi; operator bisa
   * memeriksa versi lainnya tanpa menutup popup. Halaman me-remount dialog per
   * defect (`key`), jadi tiap baris selalu dibuka dengan bahasa aplikasi.
   */
  const [detailLang, setDetailLang] = useState<"id" | "en">(
    language === "id" ? "id" : "en"
  );

  const original = defect?.problemDetailOriginal ?? "";
  const english = defect?.problemDetail ?? "";
  const primary = detailLang === "id" ? original : english;
  const secondary = detailLang === "id" ? english : original;
  // Kalau versi yang dipilih belum ada (mis. data lama baru punya satu bahasa),
  // tampilkan versi lainnya supaya isinya tidak pernah kosong tanpa alasan.
  const shown = primary || secondary;
  const fellBack = !primary && secondary !== "";
  const hasBoth = original !== "" && english !== "";

  return (
    <Dialog
      open={defect !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("defects.detailTitle")}</DialogTitle>
          <DialogDescription>{defect?.codeGaransi ?? "-"}</DialogDescription>
        </DialogHeader>
        {defect && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.codeGaransi")}
              </dt>
              <dd className="font-mono text-xs">{defect.codeGaransi}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.timestamp")}
              </dt>
              <dd>{formatDateTime(defect.timestamp)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.product")}
              </dt>
              <dd className="font-medium">{productName}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.factory")}
              </dt>
              <dd>
                {factories.find((f) => f.id === defect.factoryId)?.name ?? "-"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.problem")}
              </dt>
              <dd>
                {problems.find((p) => p.id === defect.problemId)?.name ?? "-"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">
                {t("common.quantity")}
              </dt>
              <dd className="tabular-nums">{formatNumber(defect.quantity)}</dd>
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {t("common.value")}
                </dt>
                <dd className="tabular-nums">
                  {formatIDR(defect.value ?? 0)}
                </dd>
              </div>
            )}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground">
                  {t("defects.problemDetail")}
                </dt>
                {(hasBoth || fellBack) && (
                  <div className="flex items-center gap-1" role="group">
                    {(["id", "en"] as const).map((code) => (
                      <Button
                        key={code}
                        type="button"
                        size="sm"
                        variant={detailLang === code ? "default" : "outline"}
                        className="h-6 px-2 text-[11px] uppercase"
                        aria-pressed={detailLang === code}
                        onClick={() => setDetailLang(code)}
                      >
                        {code}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <dd className="whitespace-pre-wrap">{shown || "-"}</dd>
              {fellBack && (
                <dd className="text-xs text-muted-foreground">
                  {t("defects.problemDetailMissing")}
                </dd>
              )}
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("common.media")}
              </dt>
              <dd className="flex gap-3">
                {defect.photosLink ? (
                  <a
                    href={defect.photosLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    <Camera className="size-4" /> {t("common.photo")}
                  </a>
                ) : null}
                {defect.videosLink ? (
                  <a
                    href={defect.videosLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                  >
                    <Video className="size-4" /> {t("common.video")}
                  </a>
                ) : null}
                {!defect.photosLink && !defect.videosLink && (
                  <span className="text-muted-foreground">-</span>
                )}
              </dd>
            </div>
          </dl>
        )}
        {defect && isAdmin && (onEdit || onDelete) && (
          <DialogFooter className="sm:justify-between">
            {onDelete ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(defect)}
              >
                <Trash2 className="size-4" />
                {t("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("common.close")}
              </Button>
              {onEdit ? (
                <Button type="button" onClick={() => onEdit(defect)}>
                  <Pencil className="size-4" />
                  {t("common.edit")}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
