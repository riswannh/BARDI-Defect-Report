"use client";

import { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import {
  formatNumber,
  formatPoCurrency,
  PO_CURRENCIES,
  type PoCurrency,
} from "@/lib/format";
import {
  DEFAULT_KETERANGAN,
  KETERANGAN_OPTIONS,
  PPN_OPTIONS,
  type KeteranganOption,
  type PpnStatus,
} from "@/lib/api/validation";
import type { Factory, Product } from "@/lib/types";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Save } from "lucide-react";

export interface PoForm {
  poNumber: string;
  /** Tanggal PO, diisi manual operator (input datetime-local). */
  poDate: string;
  productId: string;
  factoryId: string;
  quantity: string;
  pricePerPcs: string;
  currency: PoCurrency;
  /** Status PPN: "PPN" atau "Non PPN". Hanya penanda, tidak menambah total. */
  ppn: PpnStatus;
  /** Keterangan: salah satu dari tiga pilihan tetap. */
  keterangan: KeteranganOption;
}

/** Nilai `datetime-local` untuk waktu sekarang (waktu lokal, bukan UTC). */
function localDateTimeValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function emptyPoForm(): PoForm {
  return {
    poNumber: "",
    // Default waktu sekarang supaya operator tidak perlu mengisi dari nol;
    // nilainya tetap bisa diubah ke tanggal PO yang sebenarnya.
    poDate: localDateTimeValue(),
    productId: "",
    factoryId: "",
    quantity: "",
    pricePerPcs: "",
    currency: "Rp",
    // Default "Non PPN"; operator dapat mengubahnya ke "PPN" bila PO-nya kena pajak.
    ppn: "Non PPN",
    keterangan: DEFAULT_KETERANGAN,
  };
}

/** Ada isian yang bermakna? Dipakai untuk konfirmasi saat menutup form. */
export function poFormHasContent(form: PoForm): boolean {
  return (
    form.poNumber.trim() !== "" ||
    form.productId !== "" ||
    form.factoryId !== "" ||
    form.quantity.trim() !== "" ||
    form.pricePerPcs.trim() !== ""
  );
}

/** Label dropdown produk — nama produk saja, tanpa SKU (lihat SPEC keputusan SKU). */
export function productOptionLabel(product: Product): string {
  return product.name;
}

/**
 * Dialog tambah/ubah PO Product.
 *
 * SKU dipilih lebih dulu, lalu nama produk terisi otomatis: SKU melekat pada
 * produk (bukan disimpan di baris PO), jadi `productId` tetap satu-satunya
 * rujukan dan nama produk tidak bisa berbeda dari SKU yang dipilih.
 */
export function PoFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  onSubmit,
  products,
  factories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: number | null;
  form: PoForm;
  onFormChange: React.Dispatch<React.SetStateAction<PoForm>>;
  onSubmit: (mode: "save" | "saveAndAddAnother") => void | Promise<void>;
  products: Product[];
  factories: Factory[];
}) {
  const { t } = useLanguage();
  const isEditing = editingId !== null;
  const [discardOpen, setDiscardOpen] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Pilihan keterangan datang dari konstanta di kode, bukan dari API master.
  const keteranganOptions = useMemo(
    () => KETERANGAN_OPTIONS.map((option) => ({ value: option, label: option })),
    []
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.id),
        // Label memuat SKU lebih dulu, jadi kotak pencarian Select bisa dipakai
        // untuk mencari dengan SKU maupun dengan nama produk.
        label: productOptionLabel(p),
      })),
    [products]
  );

  const quantity = Number(form.quantity) || 0;
  const price = Number(form.pricePerPcs) || 0;
  const total = quantity * price;
  const dirty = poFormHasContent(form);

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (!dirty) {
      onOpenChange(false);
      return;
    }
    setDiscardOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void onSubmit("save");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-2xl"
          initialFocus={firstFieldRef}
          finalFocus={isEditing ? true : false}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("po.editTitle") : t("po.addTitle")}
            </DialogTitle>
            <DialogDescription>{t("po.formHint")}</DialogDescription>
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
                <Label htmlFor="po-number">{t("po.poNumber")}</Label>
                <Input
                  id="po-number"
                  ref={firstFieldRef}
                  value={form.poNumber}
                  onChange={(e) =>
                    onFormChange((f) => ({ ...f, poNumber: e.target.value }))
                  }
                  placeholder={t("po.poNumberPlaceholder")}
                />
              </div>

              {/* Tanggal PO diisi manual; default-nya waktu sekarang. */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="po-date">{t("po.timestamp")}</Label>
                <Input
                  id="po-date"
                  type="datetime-local"
                  value={form.poDate}
                  onChange={(e) =>
                    onFormChange((f) => ({ ...f, poDate: e.target.value }))
                  }
                />
              </div>

              {/* SKU dan Product digabung: satu dropdown yang menampilkan nama
                  produk. Ke database tetap tersimpan productId, dan SKU produk
                  tetap ikut di data karena melekat pada produknya. */}
              <div className="flex flex-col gap-1.5">
                <Label>{t("po.product")}</Label>
                <Select
                  value={form.productId}
                  onValueChange={(v) =>
                    onFormChange((f) => ({ ...f, productId: String(v) }))
                  }
                  items={productOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("po.selectProduct")} />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
                <Label htmlFor="po-qty">{t("common.quantity")}</Label>
                <Input
                  id="po-qty"
                  type="number"
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) =>
                    onFormChange((f) => ({ ...f, quantity: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="po-price">{t("po.pricePerPcs")}</Label>
                <Input
                  id="po-price"
                  type="number"
                  inputMode="numeric"
                  value={form.pricePerPcs}
                  onChange={(e) =>
                    onFormChange((f) => ({ ...f, pricePerPcs: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t("po.currency")}</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) =>
                    onFormChange((f) => ({
                      ...f,
                      currency: String(v) as PoCurrency,
                    }))
                  }
                  items={PO_CURRENCIES.map((c) => ({ value: c, label: c }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PO_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t("po.ppn")}</Label>
                {/* Hanya penanda: tidak ada angka yang ditambahkan ke Total. */}
                <Select
                  value={form.ppn}
                  onValueChange={(v) =>
                    onFormChange((f) => ({ ...f, ppn: String(v) as PpnStatus }))
                  }
                  items={PPN_OPTIONS.map((option) => ({
                    value: option,
                    label: option,
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PPN_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Total dihitung di form; server menghitung ulang saat menyimpan. */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="po-total">{t("po.totalValue")}</Label>
                <Input
                  id="po-total"
                  value={formatPoCurrency(total, form.currency)}
                  readOnly
                  className="bg-muted/50 font-medium tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  {t("po.totalHint", {
                    price: formatNumber(price),
                    qty: formatNumber(quantity),
                  })}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("po.keterangan")}</Label>
              {/* Tiga pilihan tetap — bukan master yang bisa di-CRUD. */}
              <Select
                value={form.keterangan}
                onValueChange={(v) =>
                  onFormChange((f) => ({
                    ...f,
                    keterangan: String(v) as KeteranganOption,
                  }))
                }
                items={keteranganOptions}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keteranganOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    onClick={() => void onSubmit("saveAndAddAnother")}
                  >
                    <Save className="size-4" />
                    {t("po.saveAndAddAnother")}
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
