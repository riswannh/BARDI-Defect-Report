"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { formatIDR, formatNumber, priceMonthLabel } from "@/lib/format";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Lightbulb, Save, WandSparkles } from "lucide-react";
import {
  type DefectForm,
  type DefectRow,
  type SelectOption,
  formHasContent,
  suggestNextCode,
} from "./defect-form";
import type { Factory, ProductPrice } from "@/lib/types";

interface DefectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = tambah baru; angka = sedang mengubah defect tersebut. */
  editingId: number | null;
  /** Judul hanya menampilkan "(n/N)" saat ubah massal berjalan. */
  editPosition?: { index: number; total: number };
  form: DefectForm;
  onFormChange: React.Dispatch<React.SetStateAction<DefectForm>>;
  onSubmit: (mode: "save" | "saveAndAddAnother") => void | Promise<void>;
  isAdmin: boolean;
  defects: DefectRow[];
  factories: Factory[];
  productOptions: SelectOption[];
  problemOptions: SelectOption[];
  statusOptions: SelectOption[];
  /** Semua harga produk (semua periode) untuk menghitung value. */
  productPrices: ProductPrice[];
}

export function DefectFormDialog({
  open,
  onOpenChange,
  editingId,
  editPosition,
  form,
  onFormChange,
  onSubmit,
  isAdmin,
  defects,
  factories,
  productOptions,
  problemOptions,
  statusOptions,
  productPrices,
}: DefectFormDialogProps) {
  const { t } = useLanguage();
  const codeInputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingId !== null;
  const [discardOpen, setDiscardOpen] = useState(false);

  const suggestedCode = useMemo(
    () => (isEditing ? null : suggestNextCode(defects, factories, form.factoryId)),
    [isEditing, defects, factories, form.factoryId]
  );

  /**
   * Harga master milik produk terpilih, periode terbaru dulu. Labelnya memuat
   * periode supaya operator tahu harga mana yang dipakai.
   */
  const priceOptions = useMemo(
    () =>
      productPrices
        .filter(
          (row) =>
            form.productId !== "" && row.productId === Number(form.productId)
        )
        .sort(
          (a, b) =>
            b.year.localeCompare(a.year) || b.month.localeCompare(a.month)
        )
        .map((row) => ({
          value: String(row.id),
          label: `${priceMonthLabel(row.month)} ${row.year} — ${formatIDR(row.price)}`,
        })),
    [productPrices, form.productId]
  );

  const selectedPrice = productPrices.find(
    (row) => String(row.id) === form.productPriceId
  );

  // Isian awal saat dialog dibuka. "Kotor" berarti berubah dari kondisi awal,
  // bukan sekadar ada isi bawaan (mis. pabrik yang dibawa dari entri sebelumnya).
  const [baseline, setBaseline] = useState("");
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) setBaseline(JSON.stringify(form));
    wasOpen.current = open;
    // Sengaja hanya bergantung pada `open`: baseline diambil sekali per pembukaan,
    // bukan pada setiap ketikan (form memang berubah terus saat diisi).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const changed = open && JSON.stringify(form) !== baseline;

  const dirty = formHasContent(form);

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    // Ubah massal punya alurnya sendiri (lanjut ke data berikutnya), dan form
    // yang belum diisi apa-apa boleh ditutup langsung.
    if (isEditing || !dirty) {
      onOpenChange(false);
      return;
    }
    setDiscardOpen(true);
  }

  function applySuggestedCode() {
    if (!suggestedCode) return;
    onFormChange((f) => ({ ...f, codeGaransi: suggestedCode }));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void onSubmit("save");
    }
  }

  const title = isEditing
    ? editPosition && editPosition.total > 1
      ? `${t("defects.editTitle")} (${editPosition.index + 1}/${editPosition.total})`
      : t("defects.editTitle")
    : t("defects.addTitle");

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-lg"
          initialFocus={codeInputRef}
          finalFocus={isEditing ? true : false}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {!isEditing && (
              <DialogDescription>{t("defects.carryOverHint")}</DialogDescription>
            )}
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit("save");
            }}
            onKeyDown={handleKeyDown}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defect-code">{t("common.codeGaransi")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="defect-code"
                    ref={codeInputRef}
                    value={form.codeGaransi}
                    onChange={(e) =>
                      onFormChange((f) => ({
                        ...f,
                        codeGaransi: e.target.value,
                      }))
                    }
                    placeholder={
                      suggestedCode ??
                      t("defects.codeNoSuggestion", { sample: "WJKT-0001" })
                    }
                  />
                  {suggestedCode && form.codeGaransi.trim() === "" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t("defects.useSuggested", { code: suggestedCode })}
                      aria-label={t("defects.useSuggested", {
                        code: suggestedCode,
                      })}
                      onClick={applySuggestedCode}
                    >
                      <WandSparkles className="size-4" />
                    </Button>
                  )}
                </div>
                {suggestedCode && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lightbulb className="size-3.5 shrink-0" />
                    {t("defects.codeHint", {
                      factory:
                        factories.find((f) => f.id === Number(form.factoryId))
                          ?.name ?? "",
                    })}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defect-timestamp">
                  {t("common.timestamp")}
                </Label>
                <Input
                  id="defect-timestamp"
                  type="datetime-local"
                  value={form.timestamp}
                  onChange={(e) =>
                    onFormChange((f) => ({ ...f, timestamp: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defect-photos">{t("defects.photoLink")}</Label>
                <Input
                  id="defect-photos"
                  value={form.photosLink}
                  onChange={(e) =>
                    onFormChange((f) => ({ ...f, photosLink: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defect-videos">{t("defects.videoLink")}</Label>
                <Input
                  id="defect-videos"
                  value={form.videosLink}
                  onChange={(e) =>
                    onFormChange((f) => ({ ...f, videosLink: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.problem")}</Label>
                <Select
                  value={form.problemId}
                  onValueChange={(v) =>
                    onFormChange((f) => ({ ...f, problemId: String(v) }))
                  }
                  items={problemOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {problemOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.status")}</Label>
                <Select
                  value={form.statusId}
                  onValueChange={(v) =>
                    onFormChange((f) => ({ ...f, statusId: String(v) }))
                  }
                  items={statusOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.product")}</Label>
                <Select
                  value={form.productId}
                  onValueChange={(v) =>
                    onFormChange((f) => {
                      const nextProductId = String(v);
                      // Produk berganti -> rujukan harga lama tidak relevan lagi.
                      // Pilih harga yang cocok dengan bulan/tahun timestamp defect.
                      const period = f.timestamp.slice(0, 7);
                      const match =
                        productPrices.find(
                          (row) =>
                            row.productId === Number(nextProductId) &&
                            `${row.year}-${row.month}` === period
                        ) ?? undefined;
                      return {
                        ...f,
                        productId: nextProductId,
                        productPriceId: match ? String(match.id) : "",
                      };
                    })
                  }
                  items={productOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("common.factory")}</Label>
                <Select
                  value={form.factoryId}
                  onValueChange={(v) =>
                    onFormChange((f) => ({ ...f, factoryId: String(v) }))
                  }
                  items={factories.map((f) => ({
                    value: String(f.id),
                    label: f.name,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {factories.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defect-qty">{t("common.quantity")}</Label>
                <Input
                  id="defect-qty"
                  type="number"
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) =>
                    onFormChange((f) => ({ ...f, quantity: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
              {isAdmin && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t("po.priceRw")}</Label>
                    {/* Harga master per bulan/tahun. Kalau dipilih, value dihitung
                        server: quantity × harga (pola yang sama dengan Value RW
                        di PO Product), jadi isian Value dikunci. */}
                    <Select
                      value={form.productPriceId}
                      onValueChange={(v) =>
                        onFormChange((f) => ({
                          ...f,
                          productPriceId: String(v ?? ""),
                        }))
                      }
                      items={priceOptions}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("po.selectPrice")} />
                      </SelectTrigger>
                      <SelectContent>
                        {priceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedPrice
                        ? t("po.valueRwHint", {
                            qty: formatNumber(Number(form.quantity) || 0),
                            price: formatIDR(selectedPrice.price),
                          })
                        : t("defects.priceManual")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="defect-value">{t("common.valueIdr")}</Label>
                    <Input
                      id="defect-value"
                      type="number"
                      inputMode="numeric"
                      value={
                        selectedPrice
                          ? String(
                              Math.round(
                                (Number(form.quantity) || 0) * selectedPrice.price
                              )
                            )
                          : form.value
                      }
                      readOnly={Boolean(selectedPrice)}
                      className={selectedPrice ? "bg-muted/50 tabular-nums" : undefined}
                      onChange={(e) =>
                        onFormChange((f) => ({ ...f, value: e.target.value }))
                      }
                      placeholder="0"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="defect-detail">
                {t("defects.problemDetail")}
              </Label>
              <Textarea
                id="defect-detail"
                value={form.problemDetail}
                onChange={(e) =>
                  onFormChange((f) => ({ ...f, problemDetail: e.target.value }))
                }
                placeholder={t("defects.problemDetailPlaceholder")}
              />
            </div>
            <DialogFooter className="sm:justify-between">
              <span className="hidden text-xs text-muted-foreground sm:block">
                {t("defects.shortcutHint")}
              </span>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {!isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!changed}
                    onClick={() => void onSubmit("saveAndAddAnother")}
                  >
                    <Save className="size-4" />
                    {t("defects.saveAndAddAnother")}
                  </Button>
                )}
                <Button type="submit">
                  {isEditing ? t("common.update") : t("common.save")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t("defects.unsavedTitle")}
        description={t("defects.unsavedBody")}
        confirmLabel={t("defects.unsavedDiscard")}
        cancelLabel={t("defects.unsavedKeepEditing")}
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
}
