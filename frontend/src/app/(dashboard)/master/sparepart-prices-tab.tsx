"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type { SparePart, SparePartPrice } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import {
  PriceList,
  type PriceInput,
  type PriceRow,
} from "@/components/price-list";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Tab "Harga Sparepart" — mekanisme harga sama dengan harga produk, hanya
 * rujukannya sparepart. Harga bersifat global per sparepart, bukan per
 * (sparepart × produk).
 *
 * Pencarian dan paging tinggal di sini supaya `master/page.tsx` tidak ikut
 * membengkak.
 */
export function SparePartPricesTab({ reloadToken = 0 }: { reloadToken?: number }) {
  const { t } = useLanguage();
  const { data: sparePartData } = useApi<SparePart[]>("/api/spare-parts");
  const { data: priceData, reload } =
    useApi<SparePartPrice[]>("/api/spare-part-prices");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Impor Excel di halaman induk menaikkan token ini; tabel dimuat ulang supaya
  // baris hasil impor langsung terlihat tanpa pindah tab.
  useEffect(() => {
    if (reloadToken > 0) reload();
  }, [reloadToken, reload]);

  const spareParts = sparePartData ?? [];
  const prices = priceData ?? [];

  const query = search.trim().toLowerCase();
  const filtered = prices.filter((item) => {
    if (!query) return true;
    const part = spareParts.find((s) => s.id === item.sparePartId);
    const name = item.sparePartName ?? part?.name ?? "";
    const sku = item.sku ?? part?.sku ?? "";
    return `${name} ${sku}`.toLowerCase().includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows: PriceRow[] = filtered
    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
    .map((item) => ({
      id: item.id,
      refId: item.sparePartId,
      price: item.price,
      month: item.month,
      year: item.year,
      sku: item.sku,
      name: item.sparePartName,
    }));

  async function addPrice(input: PriceInput) {
    try {
      await apiPost("/api/spare-part-prices", {
        sparePartId: input.refId,
        price: input.price,
        month: input.month,
        year: input.year,
      });
      reload();
      toast.success(t("price.saved"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan harga."
      );
    }
  }

  async function updatePrice(id: number, input: PriceInput) {
    try {
      await apiPatch(`/api/spare-part-prices/${id}`, {
        sparePartId: input.refId,
        price: input.price,
        month: input.month,
        year: input.year,
      });
      reload();
      toast.success(t("price.saved"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan harga."
      );
    }
  }

  async function deletePrice(id: number) {
    try {
      await apiDelete(`/api/spare-part-prices/${id}`);
      reload();
      toast.success(t("sparePartPrice.deleted"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus harga."
      );
    }
  }

  async function carryForward(input: { month: string; year: string }) {
    try {
      const res = await apiPost<{
        inserted: number;
        skipped: number;
        message: string;
      }>("/api/spare-part-prices/carry-forward", input);
      reload();
      toast.success(res.message);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyalin harga."
      );
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spare-price-search">{t("common.search")}</Label>
          <Input
            id="spare-price-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("sparePartPrice.searchPlaceholder")}
            className="w-64"
          />
        </div>
      </div>

      <PriceList
        items={rows}
        options={spareParts}
        itemLabel={t("sparePart.tab")}
        onAdd={addPrice}
        onUpdate={updatePrice}
        onDelete={deletePrice}
        onCarryForward={carryForward}
        emptyLabel={query ? t("price.emptyFiltered") : t("sparePartPrice.empty")}
      />

      {filtered.length > 0 && (
        <div className="mt-4">
          <Pagination
            totalItems={filtered.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
