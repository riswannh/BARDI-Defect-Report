"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { apiPost } from "@/lib/api-client";
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
import { Camera, Loader2, Pencil, Trash2, Video } from "lucide-react";
import type { DefectRow } from "./defect-form";
import type { Factory, Problem } from "@/lib/types";

type DetailPair = { original: string; english: string };

export function DefectDetailDialog({
  defect,
  onOpenChange,
  productName,
  factories,
  problems,
  isAdmin,
  onEdit,
  onDelete,
  onTranslated,
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
  /** Hasil terjemahan on-demand dikabarkan ke halaman supaya daftar ikut segar. */
  onTranslated?: (id: number, pair: { problemDetail: string; problemDetailOriginal: string }) => void;
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
  const [pair, setPair] = useState<DetailPair>({
    original: defect?.problemDetailOriginal ?? "",
    english: defect?.problemDetail ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const primary = detailLang === "id" ? pair.original : pair.english;
  const secondary = detailLang === "id" ? pair.english : pair.original;
  // Kalau versi yang dipilih belum ada (mis. data lama baru punya satu bahasa),
  // tampilkan versi lainnya supaya isinya tidak pernah kosong tanpa alasan.
  const shown = primary || secondary;
  const fellBack = !primary && secondary !== "";

  /**
   * Ambil bahasa yang belum ada dari Google Sheet milik user, lalu simpan ke
   * database (server yang menyimpan). Pembukaan berikutnya tidak memanggil sheet
   * lagi karena datanya sudah ada di baris defect ini.
   */
  const pick = async (code: "id" | "en") => {
    setDetailLang(code);
    if (!defect || loading) return;
    const existing = code === "id" ? pair.original : pair.english;
    if (existing.trim() !== "") {
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiPost<{ problemDetail: string; problemDetailOriginal: string }>(
        `/api/defects/${defect.id}/translate`,
        { language: code }
      );
      setPair({ original: result.problemDetailOriginal, english: result.problemDetail });
      onTranslated?.(defect.id, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={defect !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      {/*
        Sama seperti form: di ponsel popup ini bisa lebih tinggi dari layar,
        jadi butuh batas tinggi + area gulir sendiri supaya isinya terbaca.
      */}
      <DialogContent className="max-h-[85vh] overflow-y-auto overscroll-contain supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] sm:max-w-lg">
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
                <div className="flex items-center gap-1" role="group">
                  {(["id", "en"] as const).map((code) => (
                    <Button
                      key={code}
                      type="button"
                      size="sm"
                      variant={detailLang === code ? "default" : "outline"}
                      className="h-6 px-2 text-[11px] uppercase"
                      aria-pressed={detailLang === code}
                      disabled={loading && detailLang === code}
                      onClick={() => void pick(code)}
                    >
                      {code}
                    </Button>
                  ))}
                </div>
              </div>
              {loading ? (
                <dd className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("defects.problemDetailLoading")}
                </dd>
              ) : (
                <dd className="whitespace-pre-wrap">{shown || "-"}</dd>
              )}
              {!loading && fellBack && (
                <dd className="text-xs text-muted-foreground">
                  {t("defects.problemDetailMissing")}
                </dd>
              )}
              {!loading && !primary && !secondary && (
                <dd className="text-xs text-muted-foreground">
                  {t("defects.problemDetailEmpty")}
                </dd>
              )}
              {error && (
                <dd className="text-xs text-destructive">
                  {t("defects.problemDetailLoadFailed", { message: error })}
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
