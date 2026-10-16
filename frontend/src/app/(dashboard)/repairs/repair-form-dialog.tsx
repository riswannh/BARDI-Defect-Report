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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { MONTHS } from "@/lib/format";
import { pickProductPrice } from "@/lib/prices";
import type { Product, ProductPrice, Problem, SparePart } from "@/lib/types";

/** Jenis harga acuan Saving Value — sama dengan `DEFAULT_PRICE_TYPE` di server. */
const VALUE_PRICE_TYPE = "Regional Warehouse";

/**
 * Pilihan dropdown modul Repair, disamakan dengan sheet "Reparasi RFB" (lihat
 * `REPAIR_ORIGINS`/`REPAIR_STATUSES`/… di `src/lib/api/validation.ts`). Disalin
 * di sini supaya berkas validasi server (yang memuat zod) tidak ikut ke bundel
 * halaman. Kalau daftar di server berubah, ubah juga di sini.
 */
const PIC_VALUES = ["Aji", "Almer", "Aziz", "Danang", "Danu", "Hendi", "Roland"];

const ORIGIN_LABELS = [
  { value: "Customer", key: "repair.origin.customer" },
  { value: "Distri", key: "repair.origin.distri" },
  { value: "OR", key: "repair.origin.or" },
] as const;

const STATUS_LABELS = [
  { value: "Belum Di Buka", key: "repair.status.belumDibuka" },
  { value: "Done Kirim", key: "repair.status.doneKirim" },
  { value: "Done Repair", key: "repair.status.doneRepair" },
  { value: "Proses", key: "repair.status.proses" },
  { value: "Tidak Ada Data", key: "repair.status.tidakAdaData" },
] as const;

const RESOLUTION_LABELS = [
  { value: "Ganti Komponen", key: "repair.resolution.gantiKomponen" },
  { value: "Ganti Sparepart", key: "repair.resolution.gantiSparepart" },
  { value: "Maintenance", key: "repair.resolution.maintenance" },
  { value: "Replacement BJ", key: "repair.resolution.replacementBj" },
  {
    value: "Replacement Produk Baru",
    key: "repair.resolution.replacementProdukBaru",
  },
] as const;

const NONE = "0";

/** "2026-04-07" -> "2026-04" (bulan disimpan server dalam bentuk ini). */
function monthOf(date: string) {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
}

const monthLabel = (value: string) => {
  const index = Number(value.slice(5, 7)) - 1;
  return `${MONTHS[index] ?? value.slice(5, 7)} ${value.slice(0, 4)}`;
};

const idOf = (value: string) => (Number(value) > 0 ? Number(value) : 0);
/** "2026-04-07 10:30" / "2026-04-07T10:30:00" -> "2026-04-07T10:30". */
const inputDateTime = (value: string) =>
  value ? value.replace(" ", "T").slice(0, 16) : "";
/** Nilai dari `<input type="datetime-local">` sudah berbentuk "YYYY-MM-DDTHH:mm". */
const textDateTime = (value: string) => value.trim();

export interface RepairFormValues {
  claimId: string;
  date: string;
  productId: number;
  quantity: number;
  value: number;
  priceType: string;
  origin: string;
  customerName: string;
  customerPhone: string;
  resi: string;
  customerIssue: string;
  photoPackageLink: string;
  photoCompletenessLink: string;
  status: string;
  startAt: string;
  finishAt: string;
  note: string;
  pic: string;
  resolution: string;
  problemId: number;
  sparePart1Id: number;
  sparePart2Id: number;
  sparePart3Id: number;
  /** Nama sparepart apa adanya dari sheet, dipakai kalau belum ada di Data Master. */
  sparePart1Text: string;
  sparePart2Text: string;
  sparePart3Text: string;
  noteClosing: string;
}

/** Nilai awal form untuk baris yang sedang diubah (dipakai juga oleh pemanggil). */
export interface RepairRowValues {
  id: number;
  claimId: string;
  date: string;
  /** NULL = nama produk di sheet belum ada di Data Master (baris tidak lengkap). */
  productId: number | null;
  quantity: number;
  value: number;
  priceType?: string | null;
  origin: string;
  customerName: string;
  customerPhone: string;
  resi: string;
  customerIssue: string;
  photoPackageLink: string;
  photoCompletenessLink: string;
  status: string;
  startAt: string;
  finishAt: string;
  note: string;
  pic: string;
  resolution: string;
  problemId?: number | null;
  sparePart1Id?: number | null;
  sparePart2Id?: number | null;
  sparePart3Id?: number | null;
  /** Teks sparepart apa adanya dari sheet kalau namanya belum ada di Data Master. */
  sparePart1Text?: string;
  sparePart2Text?: string;
  sparePart3Text?: string;
  noteClosing: string;
}

export function RepairFormDialog({
  open,
  onOpenChange,
  row,
  products,
  problems,
  spareParts,
  productPrices,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = tambah baris baru. */
  row: RepairRowValues | null;
  products: Product[];
  problems: Problem[];
  spareParts: SparePart[];
  productPrices: ProductPrice[];
  onSave: (
    values: RepairFormValues,
    editingId: number | null
  ) => Promise<boolean>;
}) {
  const { t } = useLanguage();

  const editingId = row?.id ?? null;
  // Nilai awal dihitung sekali saat komponen dipasang; pemanggil me-remount
  // dialog lewat `key` setiap kali barisnya berbeda (pola yang sama dipakai
  // dialog PO), jadi tidak perlu menyalin ulang state di dalam effect.
  const [claimId, setClaimId] = useState(row?.claimId ?? "");
  const [date, setDate] = useState(row?.date ?? "");
  const [productId, setProductId] = useState(
    row ? String(row.productId ?? 0) : ""
  );
  const [quantity, setQuantity] = useState(String(row?.quantity ?? 1));
  const [valueEdit, setValueEdit] = useState<string | null>(
    row ? String(row.value) : null
  );
  const [priceType] = useState(row?.priceType || VALUE_PRICE_TYPE);
  const [origin, setOrigin] = useState(row?.origin || "Distri");
  const [status, setStatus] = useState(row?.status || "Proses");
  const [customerName, setCustomerName] = useState(row?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(row?.customerPhone ?? "");
  const [resi, setResi] = useState(row?.resi ?? "");
  const [customerIssue, setCustomerIssue] = useState(row?.customerIssue ?? "");
  const [photoPackageLink, setPhotoPackageLink] = useState(
    row?.photoPackageLink ?? ""
  );
  const [photoCompletenessLink, setPhotoCompletenessLink] = useState(
    row?.photoCompletenessLink ?? ""
  );
  const [startAt, setStartAt] = useState(inputDateTime(row?.startAt ?? ""));
  const [finishAt, setFinishAt] = useState(inputDateTime(row?.finishAt ?? ""));
  const [note, setNote] = useState(row?.note ?? "");
  const [pic, setPic] = useState(row?.pic ?? "");
  const [resolution, setResolution] = useState(row?.resolution ?? "");
  const [problemId, setProblemId] = useState(String(row?.problemId ?? 0));
  const [spare1, setSpare1] = useState(String(row?.sparePart1Id ?? 0));
  const [spare2, setSpare2] = useState(String(row?.sparePart2Id ?? 0));
  const [spare3, setSpare3] = useState(String(row?.sparePart3Id ?? 0));
  // Teks apa adanya untuk sparepart yang belum ada di Data Master; dipakai
  // sebagai nilai select supaya namanya tetap terlihat dan tidak hilang.
  const [spare1Text] = useState((row?.sparePart1Text ?? "").trim());
  const [spare2Text] = useState((row?.sparePart2Text ?? "").trim());
  const [spare3Text] = useState((row?.sparePart3Text ?? "").trim());
  const [noteClosing, setNoteClosing] = useState(row?.noteClosing ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const month = monthOf(date);
  const unitPrice =
    Number(productId) > 0 && month
      ? Number(
          pickProductPrice(
            productPrices,
            Number(productId),
            month,
            priceType
          )?.price ?? 0
        )
      : 0;
  const computedValue = unitPrice * (Number(quantity) || 0);
  const value = valueEdit ?? String(computedValue);
  const priceMissing = Number(productId) > 0 && Boolean(month) && unitPrice === 0;

  const problemKnown = problems.some((p) => p.id === Number(problemId));
  const spareKnown = (value: string) =>
    spareParts.some((s) => s.id === Number(value));
  /** Teks yang dikirim ke API: nama master kalau id-nya ada, kalau tidak teks apa adanya. */
  const textOf = (value: string, fallback: string) =>
    spareKnown(value)
      ? (spareParts.find((s) => s.id === Number(value))?.name ?? fallback)
      : fallback;

  function handleQuantity(next: string) {
    setQuantity(next);
    // Angka yang pernah diketik operator dilepas lagi supaya Saving Value dihitung
    // ulang dari quantity baru (perilaku "auto-isi" yang diharapkan).
    setValueEdit(null);
  }

  function handleProduct(next: string) {
    setProductId(next);
    setValueEdit(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuantity = Math.max(0, Math.trunc(Number(quantity) || 0));
    setError(null);

    if (!claimId.trim() || !date || !(Number(productId) > 0)) {
      setError(t("repair.form.required"));
      return;
    }

    const values: RepairFormValues = {
      claimId: claimId.trim(),
      date,
      productId: Number(productId),
      quantity: cleanQuantity,
      value: Math.max(0, Math.trunc(Number(value) || 0)),
      priceType,
      origin,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      resi: resi.trim(),
      customerIssue: customerIssue.trim(),
      photoPackageLink: photoPackageLink.trim(),
      photoCompletenessLink: photoCompletenessLink.trim(),
      status,
      startAt: textDateTime(startAt),
      finishAt: textDateTime(finishAt),
      note: note.trim(),
      pic,
      resolution,
      problemId: idOf(problemId),
      sparePart1Id: idOf(spare1),
      sparePart2Id: idOf(spare2),
      sparePart3Id: idOf(spare3),
      sparePart1Text: textOf(spare1, spare1Text),
      sparePart2Text: textOf(spare2, spare2Text),
      sparePart3Text: textOf(spare3, spare3Text),
      noteClosing: noteClosing.trim(),
    };

    setPending(true);
    try {
      const ok = await onSave(values, editingId);
      if (ok) onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editingId === null ? t("repair.addTitle") : t("repair.editTitle")}
          </DialogTitle>
          <DialogDescription>{t("repair.description")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            // Ctrl/Cmd + Enter menyimpan tanpa pindah ke tombol Simpan.
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.currentTarget.requestSubmit();
            }
          }}
          className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-claim">{t("repair.form.claim")}</Label>
              <Input
                id="repair-claim"
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                placeholder="RFB-0001"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-date">{t("repair.form.date")}</Label>
              <Input
                id="repair-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("common.product")}</Label>
              <Select
                value={productId}
                onValueChange={(v) => handleProduct(String(v))}
                items={products.map((p) => ({ value: String(p.id), label: p.name }))}
              >
                <SelectTrigger id="repair-product" className="w-full">
                  <SelectValue placeholder={t("repair.form.pickPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-quantity">{t("common.quantity")}</Label>
              <Input
                id="repair-quantity"
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => handleQuantity(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="repair-month">{t("repair.form.month")}</Label>
              <Input
                id="repair-month"
                value={month ? monthLabel(month) : ""}
                readOnly
                placeholder="-"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="repair-value">{t("repair.form.value")}</Label>
              <Input
                id="repair-value"
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValueEdit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("repair.form.savingHint")}
              </p>
              {priceMissing && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("repair.form.noPriceHint")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("repair.form.origin")}</Label>
              <Select
                value={origin}
                onValueChange={(v) => setOrigin(String(v))}
                items={ORIGIN_LABELS.map((o) => ({
                  value: o.value,
                  label: t(o.key),
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGIN_LABELS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {t(o.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("common.status")}</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(String(v))}
                items={STATUS_LABELS.map((s) => ({
                  value: s.value,
                  label: t(s.key),
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_LABELS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(s.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-customer-name">
                {t("repair.form.customerName")}
              </Label>
              <Input
                id="repair-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-customer-phone">
                {t("repair.form.customerPhone")}
              </Label>
              <Input
                id="repair-customer-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="repair-resi">
                {t("repair.table.resi")}
              </Label>
              <Input
                id="repair-resi"
                value={resi}
                onChange={(e) => setResi(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="repair-customer-issue">
                {t("repair.form.customerIssue")}
              </Label>
              <Textarea
                id="repair-customer-issue"
                rows={2}
                value={customerIssue}
                onChange={(e) => setCustomerIssue(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-photo-package">
                {t("common.photoPackage")}
              </Label>
              <Input
                id="repair-photo-package"
                value={photoPackageLink}
                onChange={(e) => setPhotoPackageLink(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-photo-completeness">
                {t("repair.form.photoCompleteness")}
              </Label>
              <Input
                id="repair-photo-completeness"
                value={photoCompletenessLink}
                onChange={(e) => setPhotoCompletenessLink(e.target.value)}
                placeholder="https://"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-start">{t("repair.form.start")}</Label>
              <Input
                id="repair-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-finish">{t("repair.form.finish")}</Label>
              <Input
                id="repair-finish"
                type="datetime-local"
                value={finishAt}
                onChange={(e) => setFinishAt(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("repair.form.problem")}</Label>
              <Select
                value={problemKnown ? problemId : NONE}
                onValueChange={(v) => setProblemId(String(v))}
                items={[
                  { value: NONE, label: t("repair.form.pickPlaceholder") },
                  ...problems.map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("repair.form.pickPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {t("repair.form.pickPlaceholder")}
                  </SelectItem>
                  {problems.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("repair.form.pic")}</Label>
              <Select
                value={pic}
                onValueChange={(v) => setPic(String(v))}
                items={[
                  { value: "", label: t("repair.form.pickPlaceholder") },
                  ...PIC_VALUES.map((name) => ({ value: name, label: name })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("repair.form.pickPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("repair.form.pickPlaceholder")}</SelectItem>
                  {PIC_VALUES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {[1, 2, 3].map((slot) => {
              const current = slot === 1 ? spare1 : slot === 2 ? spare2 : spare3;
              const setCurrent =
                slot === 1 ? setSpare1 : slot === 2 ? setSpare2 : setSpare3;
              const text =
                slot === 1 ? spare1Text : slot === 2 ? spare2Text : spare3Text;
              const known = spareKnown(current);
              const custom = !known && text !== "" ? text : "";
              return (
                <div key={slot} className="flex flex-col gap-2">
                  <Label>{t("repair.form.sparePart", { n: slot })}</Label>
                  <Select
                    value={custom !== "" ? custom : known ? current : NONE}
                    onValueChange={(v) => setCurrent(String(v))}
                    items={[
                      { value: NONE, label: t("repair.form.pickPlaceholder") },
                      ...spareParts.map((s) => ({
                        value: String(s.id),
                        label: s.name,
                      })),
                      ...(custom !== ""
                        ? [{ value: custom, label: custom }]
                        : []),
                    ]}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("repair.form.pickPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        {t("repair.form.pickPlaceholder")}
                      </SelectItem>
                      {spareParts.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                      {custom !== "" && (
                        <SelectItem value={custom}>{custom}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {custom !== "" && (
                    <span className="text-xs text-muted-foreground">
                      {t("repair.sparePartCustom")}
                    </span>
                  )}
                </div>
              );
            })}

            <div className="flex flex-col gap-2">
              <Label>{t("repair.form.resolution")}</Label>
              <Select
                value={resolution}
                onValueChange={(v) => setResolution(String(v))}
                items={[
                  { value: "", label: t("repair.form.pickPlaceholder") },
                  ...RESOLUTION_LABELS.map((r) => ({
                    value: r.value,
                    label: t(r.key),
                  })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("repair.form.pickPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("repair.form.pickPlaceholder")}</SelectItem>
                  {RESOLUTION_LABELS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {t(r.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="repair-note">{t("repair.form.note")}</Label>
              <Input
                id="repair-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="repair-note-closing">
                {t("repair.form.noteClosing")}
              </Label>
              <Textarea
                id="repair-note-closing"
                rows={2}
                value={noteClosing}
                onChange={(e) => setNoteClosing(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="sticky bottom-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {editingId === null ? t("common.save") : t("common.update")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
