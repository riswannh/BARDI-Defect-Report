"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/lib/use-api";
import { formatDateTime } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { linkDefect, type TicketDefectLink } from "./ticket-preview-data";
import type { Defect } from "@/lib/types";

export type DefectPickerRow = Defect & {
  productName?: string | null;
  factoryName?: string | null;
  problemName?: string | null;
};

/** Daftar defect produk ini, diambil dari API Data Defect yang sudah ada. */
export function TicketDefectPicker({
  productId,
  selected,
  onToggle,
}: {
  productId: number | null;
  selected: TicketDefectLink[];
  onToggle: (link: TicketDefectLink) => void;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const { data, loading } = useApi<DefectPickerRow[]>(productId ? `/api/defects?productId=${productId}` : null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((row) =>
      [row.codeGaransi, row.problemDetail, row.problemName, row.productName]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [data, search]);

  if (!productId) {
    return <p className="text-sm text-muted-foreground">{t("ticket.picker.needProduct")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-defect-search">{t("ticket.defect.search")}</Label>
        <Input
          id="ticket-defect-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("ticket.defect.searchPlaceholder")}
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-lg border">
        {loading && <p className="px-3 py-4 text-sm text-muted-foreground">{t("common.loading")}</p>}
        {!loading && rows.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground">{t("ticket.defect.empty")}</p>
        )}
        <ul className="divide-y">
          {/* ponytail: tampilkan 50 baris pertama; tambah paging kalau perlu */}
          {rows.slice(0, 50).map((row) => {
            const checked = selected.some((item) => item.defectId === row.id);
            return (
              <li key={row.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-primary/5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={checked}
                    onChange={() => onToggle(linkDefect(row))}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block font-medium">{row.codeGaransi}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(row.timestamp)} · {row.productName ?? "-"} · {row.problemName ?? "-"} ·{" "}
                      {t("common.qty")}: {row.quantity}
                    </span>
                    {row.problemDetail && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{row.problemDetail}</span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Data defect yang sudah dikaitkan ke tiket — tanpa kolom Value (IDR). */
export function TicketDefectList({
  defects,
  showFactory = true,
}: {
  defects: TicketDefectLink[];
  /** CS tidak boleh melihat pabrik, jadi barisnya dimatikan untuk peran itu. */
  showFactory?: boolean;
}) {
  const { t } = useLanguage();
  if (defects.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("ticket.detail.noDefects")}</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {defects.map((defect) => (
        <li key={defect.defectId} className="rounded-lg border bg-card p-3 text-sm">
          <p className="font-medium">{defect.codeGaransi}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <dt>{t("common.timestamp")}</dt>
            <dd>{formatDateTime(defect.timeStamp)}</dd>
            <dt>{t("common.product")}</dt>
            <dd>{defect.productName || "-"}</dd>
            <dt>{t("common.problem")}</dt>
            <dd>{defect.problemName || "-"}</dd>
            <dt>{t("common.qty")}</dt>
            <dd>{defect.quantity}</dd>
            {showFactory && (
              <>
                <dt>{t("common.factory")}</dt>
                <dd>{defect.factoryName || "-"}</dd>
              </>
            )}
          </dl>
          {(defect.photosLink || defect.videosLink) && (
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {defect.photosLink && (
                <a href={defect.photosLink} target="_blank" rel="noreferrer" className="text-primary underline">
                  {t("common.photo")}
                </a>
              )}
              {defect.videosLink && (
                <a href={defect.videosLink} target="_blank" rel="noreferrer" className="text-primary underline">
                  {t("common.video")}
                </a>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
