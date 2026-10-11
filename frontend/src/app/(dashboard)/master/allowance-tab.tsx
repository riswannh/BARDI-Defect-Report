"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { apiDelete, apiPatch, apiPost } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import type { DefectAllowance } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Tab "Allowance Defect" — limit Rupiah SETAHUN, satu baris per tahun.
 *
 * Tab ini hanya ada di halaman Data Master yang sudah dibungkus `AdminGuard`,
 * dan endpoint `/api/defect-allowances` memakai `requireAdmin()`, jadi role
 * Pabrik tidak bisa melihat angkanya sama sekali.
 *
 * Angka limit TIDAK diprorata di sini: halaman Report yang memprorata mengikuti
 * periode filter (`src/lib/allowance.ts`).
 */
export function AllowanceTab() {
  const { t } = useLanguage();
  const { data, reload } = useApi<DefectAllowance[]>("/api/defect-allowances");
  const rows = data ?? [];

  const [year, setYear] = useState("");
  const [limit, setLimit] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  function resetForm() {
    setYear("");
    setLimit("");
    setEditingId(null);
  }

  async function submit() {
    const yearValue = year.trim();
    // Limit ditulis sebagai angka Rupiah; titik/spasi pemisah dibuang.
    const limitValue = Number(limit.replace(/[^\d]/g, ""));
    if (!/^\d{4}$/.test(yearValue)) {
      toast.error(t("allowance.yearInvalid"));
      return;
    }
    if (!limit.trim() || !Number.isFinite(limitValue) || limitValue < 0) {
      toast.error(t("allowance.limitInvalid"));
      return;
    }

    const payload = { year: yearValue, limitValue };
    try {
      if (editingId === null) {
        await apiPost("/api/defect-allowances", payload);
      } else {
        await apiPatch(`/api/defect-allowances/${editingId}`, payload);
      }
      resetForm();
      reload();
      toast.success(t("allowance.saved"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("allowance.saveFailed")
      );
    }
  }

  async function remove(row: DefectAllowance) {
    try {
      await apiDelete(`/api/defect-allowances/${row.id}`);
      if (editingId === row.id) resetForm();
      reload();
      toast.success(t("allowance.deleted", { year: row.year }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("allowance.saveFailed")
      );
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">{t("allowance.hint")}</p>

      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="allowance-year">{t("allowance.year")}</Label>
          <Input
            id="allowance-year"
            value={year}
            inputMode="numeric"
            placeholder={t("allowance.yearPlaceholder")}
            onChange={(e) => setYear(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="allowance-limit">{t("allowance.limit")}</Label>
          <Input
            id="allowance-limit"
            value={limit}
            inputMode="numeric"
            placeholder={t("allowance.limitPlaceholder")}
            onChange={(e) => setLimit(e.target.value)}
            className="w-56"
          />
        </div>
        <Button onClick={submit}>
          {editingId === null ? t("allowance.add") : t("allowance.update")}
        </Button>
        {editingId !== null && (
          <Button variant="outline" onClick={resetForm}>
            {t("allowance.cancel")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("allowance.empty")}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("allowance.year")}</TableHead>
              <TableHead>{t("allowance.limit")}</TableHead>
              <TableHead>{t("allowance.perMonth")}</TableHead>
              <TableHead>{t("allowance.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.year}</TableCell>
                <TableCell>{formatIDR(row.limitValue)}</TableCell>
                <TableCell>{formatIDR(row.limitValue / 12)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(row.id);
                        setYear(row.year);
                        setLimit(String(row.limitValue));
                      }}
                    >
                      {t("allowance.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remove(row)}
                    >
                      {t("allowance.delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
