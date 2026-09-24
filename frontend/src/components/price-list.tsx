"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { formatIDR, MONTHS, MONTHS_FULL } from "@/lib/format";
import { PRICE_MONTHS } from "@/lib/api/validation";
import type { ProductPrice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Copy, Pencil, Plus, Trash2, X } from "lucide-react";

interface ProductOption {
  id: number;
  name: string;
  sku?: string | null;
}

/**
 * Daftar harga produk per bulan dan tahun.
 *
 * Sengaja bukan `MasterList`: satu baris harga punya produk, nominal, dan
 * periode, bukan sekadar nama. Harga lama tidak pernah ditimpa — kalau harga
 * berubah, dibuat baris baru untuk periode berikutnya, dan baris PO lama tetap
 * merujuk ke baris lamanya.
 */
export function PriceList({
  items,
  products,
  onAdd,
  onUpdate,
  onDelete,
  onCarryForward,
  readOnly = false,
  emptyLabel,
}: {
  items: ProductPrice[];
  products: ProductOption[];
  onAdd: (input: {
    productId: number;
    price: number;
    month: string;
    year: string;
  }) => void;
  onUpdate: (
    id: number,
    input: { productId: number; price: number; month: string; year: string }
  ) => void;
  onDelete: (id: number) => void;
  onCarryForward?: (input: { month: string; year: string }) => void;
  readOnly?: boolean;
  /** Dipakai saat daftar kosong karena filter, bukan karena belum ada data. */
  emptyLabel?: string;
}) {
  const { t } = useLanguage();
  const [productId, setProductId] = useState<string>("");
  const [price, setPrice] = useState("");
  const [month, setMonth] = useState<string>(
    PRICE_MONTHS[new Date().getMonth()]
  );
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [editingId, setEditingId] = useState<number | null>(null);

  const productOptions = products.map((p) => ({
    value: String(p.id),
    label: p.sku ? `${p.name} — ${p.sku}` : p.name,
  }));

  const monthOptions = PRICE_MONTHS.map((value, index) => ({
    value,
    label: `${MONTHS_FULL[index]} (${MONTHS[index]})`,
  }));

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, i) => {
    const value = String(currentYear - 5 + i);
    return { value, label: value };
  });

  const productName = (item: ProductPrice) =>
    item.productName ?? products.find((p) => p.id === item.productId)?.name ?? `#${item.productId}`;
  const productSku = (item: ProductPrice) =>
    item.sku ?? products.find((p) => p.id === item.productId)?.sku ?? "";
  const monthLabel = (value: string) =>
    MONTHS_FULL[PRICE_MONTHS.indexOf(value as (typeof PRICE_MONTHS)[number])] ?? value;

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(price);
    if (!productId || !Number.isFinite(parsed)) return;
    onAdd({ productId: Number(productId), price: parsed, month, year });
    setPrice("");
  }

  function startEdit(item: ProductPrice) {
    setEditingId(item.id);
    setProductId(String(item.productId));
    setPrice(String(item.price));
    setMonth(item.month);
    setYear(item.year);
  }

  function submitEdit() {
    const parsed = Number(price);
    if (editingId !== null && productId && Number.isFinite(parsed)) {
      onUpdate(editingId, {
        productId: Number(productId),
        price: parsed,
        month,
        year,
      });
    }
    setEditingId(null);
    setPrice("");
  }

  function resetForm() {
    setEditingId(null);
    setPrice("");
  }

  // Base UI mengirim `null` saat pilihan dikosongkan; di form ini nilainya selalu
  // harus terisi, jadi null diabaikan (bukan diubah jadi teks "null").
  const pick =
    (setter: (value: string) => void) => (value: string | null) => {
      if (value !== null) setter(value);
    };

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <form
          onSubmit={submitAdd}
          className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
        >
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <Label>{t("price.product")}</Label>
            <Select
              value={productId}
              onValueChange={pick(setProductId)}
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
          <div className="flex w-40 flex-col gap-1.5">
            <Label htmlFor="price-value">{t("price.value")}</Label>
            <Input
              id="price-value"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="200000"
            />
          </div>
          <div className="flex w-44 flex-col gap-1.5">
            <Label>{t("price.month")}</Label>
            <Select value={month} onValueChange={pick(setMonth)} items={monthOptions}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-28 flex-col gap-1.5">
            <Label>{t("price.year")}</Label>
            <Select value={year} onValueChange={pick(setYear)} items={yearOptions}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm">
            <Plus className="size-4" /> {t("common.add")}
          </Button>
        </form>
      )}

      {/* Efisiensi: harga umumnya hanya berubah untuk sebagian produk, jadi
          pergantian bulan bisa disalin dulu lalu disunting yang berubah saja. */}
      {!readOnly && onCarryForward && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
          <span className="text-sm text-muted-foreground">
            {t("price.carryHint", { month: monthLabel(month), year })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onCarryForward({ month, year })}
          >
            <Copy className="size-4" /> {t("price.carryButton")}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.sku")}</TableHead>
              <TableHead>{t("price.product")}</TableHead>
              <TableHead className="text-right">{t("price.value")}</TableHead>
              <TableHead>{t("price.month")}</TableHead>
              <TableHead>{t("price.year")}</TableHead>
              {!readOnly && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) =>
              editingId === item.id ? (
                <TableRow key={item.id}>
                  <TableCell colSpan={5}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={productId}
                        onValueChange={pick(setProductId)}
                        items={productOptions}
                      >
                        <SelectTrigger className="h-8 w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {productOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        inputMode="decimal"
                        className="h-8 w-32"
                      />
                      <Select value={month} onValueChange={pick(setMonth)} items={monthOptions}>
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={year} onValueChange={pick(setYear)} items={yearOptions}>
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon-xs" variant="ghost" onClick={submitEdit}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="icon-xs" variant="ghost" onClick={resetForm}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {productSku(item) || "-"}
                  </TableCell>
                  <TableCell
                    className="max-w-72 truncate"
                    title={productName(item)}
                  >
                    {productName(item)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIDR(item.price)}
                  </TableCell>
                  <TableCell>{monthLabel(item.month)}</TableCell>
                  <TableCell className="tabular-nums">{item.year}</TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => startEdit(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            )}
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={readOnly ? 5 : 6}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  {emptyLabel ?? t("price.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
