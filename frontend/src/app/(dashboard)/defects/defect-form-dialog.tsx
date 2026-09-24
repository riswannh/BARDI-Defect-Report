"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  defectTotalValue,
  formHasContent,
  suggestNextCode,
} from "./defect-form";
import type { Factory, ProductPrice } from "@/lib/types";
import { pickProductPrice } from "@/lib/prices";
import { formatIDR, formatNumber, priceMonthLabel } from "@/lib/format";

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

  /**
   * Daftar harga milik produk terpilih (periode terbaru dulu) untuk memilih harga
   * secara manual. Kotak Harga RW sendiri berisi harga satuan (Rupiah per pcs).
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
          price: row.price,
          label: `${priceMonthLabel(row.month)} ${row.year} — ${formatIDR(row.price)}`,
        })),
    [productPrices, form.productId]
  );

  // Baris harga yang sedang terpakai dicocokkan dari angkanya, jadi mengetik harga
  // master secara manual pun tetap menandai barisnya di dropdown.
  const pickedPriceId =
    priceOptions.find((option) => String(option.price) === form.priceRw.trim())
      ?.value ?? "";

  const rwPrice = Number(form.priceRw) || 0;
  const rwQty = Number(form.quantity) || 0;

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
                    onFormChange((f) => {
                      const timestamp = e.target.value;
                      // Periode defect berpindah bulan/tahun -> harga master ikut
                      // menyesuaikan; kalau produk belum punya harga di periode itu
                      // dipakai harga terbarunya.
                      const match = pickProductPrice(
                        productPrices,
                        Number(f.productId),
                        timestamp.slice(0, 7)
                      );
                      return {
                        ...f,
                        timestamp,
                        ...(match ? { priceRw: String(match.price) } : {}),
                      };
                    })
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
                      // Produk berganti -> isian awal Harga RW diambil dari harga
                      // master produk itu untuk periode timestamp defect; kalau
                      // periodenya belum ada, pakai harga terbaru produk tersebut.
                      const match = pickProductPrice(
                        productPrices,
                        Number(nextProductId),
                        f.timestamp.slice(0, 7)
                      );
                      return {
                        ...f,
                        productId: nextProductId,
                        priceRw: match ? String(match.price) : "",
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
                    {/* Susunan sama dengan form PO: Harga RW = dropdown harga master
                        per bulan/tahun, Total Value = kolom baca-saja di sebelahnya.
                        Isian awalnya harga periode timestamp defect, atau harga
                        terbaru produk itu kalau periodenya belum ada; operator tetap
                        bisa memilih baris harga lain dari daftar. */}
                    <Select
                      value={pickedPriceId}
                      onValueChange={(v) => {
                        const option = priceOptions.find(
                          (item) => item.value === String(v ?? "")
                        );
                        if (!option) return;
                        onFormChange((f) => ({
                          ...f,
                          priceRw: String(option.price),
                        }));
                      }}
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
                      {rwPrice > 0
                        ? t("po.valueRwHint", {
                            qty: formatNumber(rwQty),
                            price: formatIDR(rwPrice),
                          })
                        : t("po.priceMissing")}
                    </p>
                  </div>
                  {/* Total inilah yang disimpan ke defects.value. */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="defect-total">{t("po.totalValue")}</Label>
                    <Input
                      id="defect-total"
                      value={formatIDR(defectTotalValue(form))}
                      readOnly
                      className="bg-muted/50 font-medium tabular-nums"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("po.totalHint", {
                        price: formatNumber(rwPrice),
                        qty: formatNumber(rwQty),
                      })}
                    </p>
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
