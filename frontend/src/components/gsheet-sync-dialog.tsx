"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Check, Loader2, RefreshCw, Sheet } from "lucide-react";

export type GsheetConflictField = {
  field: string;
  label: string;
  sheet: string;
  app: string;
};

export type GsheetConflict = {
  /** Kunci stabil baris di app (dipakai saat mengirim pilihan resolve). */
  rowKey: string;
  /** Label enak dibaca untuk popup; kalau tidak ada dipakai rowKey. */
  label?: string;
  sheetRow: number;
  localId: number | null;
  fields: GsheetConflictField[];
};

export type GsheetSyncSummary = {
  sheetRows: number;
  localRows: number;
  matched: number;
  inserted: number;
  appliedFields: number;
  rowsUpdated: number;
  conflicts: number;
  conflictsResolved: number;
  unchanged: number;
  appOnlyChanges: number;
  onlyInApp: number;
  skipped: number;
  /** Bulan yang di sheet 0 semua dan dilewati (khusus modul sales). */
  emptyMonths?: number;
};

export type GsheetSyncResult = {
  ok: boolean;
  tab: string;
  summary: GsheetSyncSummary;
  conflicts: GsheetConflict[];
  issues: { row?: number; code?: string; reason: string }[];
  conflictsTruncated: boolean;
};

export type GsheetResolvePayload = {
  defaultChoice?: "sheet" | "app";
  items?: { rowKey: string; choices: Record<string, "sheet" | "app"> }[];
};

interface GsheetSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: GsheetSyncResult | null;
  busy: boolean;
  onResolve: (payload: GsheetResolvePayload) => void;
  /** Judul & deskripsi sudah diterjemahkan pemanggil (beda per modul). */
  title?: string;
  description?: string;
}

const key = (rowKey: string, field: string) => `${rowKey}::${field}`;

const shorten = (value: string, max = 120) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text || "—";
};

export function GsheetSyncDialog({
  open,
  onOpenChange,
  result,
  busy,
  onResolve,
  title,
  description,
}: GsheetSyncDialogProps) {
  const { t } = useLanguage();
  // Override pilihan user per field; default "pakai Sheet" (sumber datanya).
  // ponytail: sengaja tidak di-reset tiap hasil sync baru — pilihan lama yang
  // masih relevan justru menghemat klik. Kalau perlu reset, remount via key.
  const [choices, setChoices] = useState<Record<string, "sheet" | "app">>({});

  const summary = result?.summary;
  const stats = useMemo(
    () =>
      summary
        ? [
            {
              label: t("gsheet.statFromSheet"),
              value: summary.appliedFields,
              tone: "text-emerald-600 dark:text-emerald-400",
              hint: t("gsheet.statFromSheetHint", { rows: summary.rowsUpdated }),
            },
            {
              label: t("gsheet.statInserted"),
              value: summary.inserted,
              tone: "text-emerald-600 dark:text-emerald-400",
              hint:
                summary.emptyMonths && summary.emptyMonths > 0
                  ? `${t("gsheet.statInsertedHint")} · ${t("gsheet.zeroSkipped", {
                      count: summary.emptyMonths,
                    })}`
                  : t("gsheet.statInsertedHint"),
            },
            {
              label: t("gsheet.statConflicts"),
              value: summary.conflicts,
              tone: summary.conflicts > 0 ? "text-amber-600 dark:text-amber-400" : "",
              hint: t("gsheet.statConflictsHint", { resolved: summary.conflictsResolved }),
            },
            {
              label: t("gsheet.statOnlyApp"),
              value: summary.onlyInApp,
              tone: "text-muted-foreground",
              hint: t("gsheet.statOnlyAppHint", { fields: summary.appOnlyChanges }),
            },
          ]
        : [],
    [summary, t]
  );

  if (!result) return null;

  const conflictCount = result.conflicts.reduce((n, c) => n + c.fields.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title ?? t("gsheet.title")}</DialogTitle>
          <DialogDescription>{description ?? t("gsheet.description", {
            tab: result.tab,
            sheetRows: result.summary.sheetRows,
            appRows: result.summary.localRows,
          })}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className={`text-lg font-semibold tabular-nums ${stat.tone}`}>{stat.value}</div>
              <div className="text-[11px] text-muted-foreground">{stat.hint}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <Sheet className="size-3" /> {t("gsheet.readOnly")}
          </Badge>
          {result.summary.skipped > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
              {t("gsheet.skippedBadge", { count: result.summary.skipped })}
            </Badge>
          )}
        </div>

        <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto pr-1">
          {conflictCount === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
              {t("gsheet.noConflict")}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {t("gsheet.conflictTitle", { count: conflictCount })}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t("gsheet.conflictHint")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolve({ defaultChoice: "sheet" })}
                    disabled={busy}
                  >
                    {t("gsheet.allSheet")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolve({ defaultChoice: "app" })}
                    disabled={busy}
                  >
                    {t("gsheet.allApp")}
                  </Button>
                </div>
              </div>

              {result.conflictsTruncated && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {t("gsheet.truncated", {
                    shown: conflictCount,
                    total: result.summary.conflicts,
                  })}
                </div>
              )}

              {result.conflicts.map((conflict) => (
                <div key={`${conflict.rowKey}-${conflict.sheetRow}`} className="rounded-lg border">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                    <div className="font-mono text-xs font-medium">
                      {conflict.label ?? conflict.rowKey}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("gsheet.sheetRow", { row: conflict.sheetRow })}
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">{t("gsheet.columnField")}</TableHead>
                        <TableHead>{t("gsheet.columnSheet")}</TableHead>
                        <TableHead>{t("gsheet.columnApp")}</TableHead>
                        <TableHead className="w-44 text-right">{t("gsheet.columnPick")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conflict.fields.map((field) => {
                        const chosen = choices[key(conflict.rowKey, field.field)] ?? "sheet";
                        return (
                          <TableRow key={field.field}>
                            <TableCell className="align-top text-xs font-medium">{field.label}</TableCell>
                            <TableCell className="align-top text-xs">{shorten(field.sheet)}</TableCell>
                            <TableCell className="align-top text-xs">{shorten(field.app)}</TableCell>
                            <TableCell className="align-top">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant={chosen === "sheet" ? "default" : "outline"}
                                  className="h-7 px-2 text-xs"
                                  disabled={busy}
                                  onClick={() =>
                                    setChoices((c) => ({
                                      ...c,
                                      [key(conflict.rowKey, field.field)]: "sheet",
                                    }))
                                  }
                                >
                                  {t("gsheet.pickSheet")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={chosen === "app" ? "default" : "outline"}
                                  className="h-7 px-2 text-xs"
                                  disabled={busy}
                                  onClick={() =>
                                    setChoices((c) => ({
                                      ...c,
                                      [key(conflict.rowKey, field.field)]: "app",
                                    }))
                                  }
                                >
                                  {t("gsheet.pickApp")}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </>
          )}

          {result.issues.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4" /> {t("gsheet.issueTitle", { count: result.issues.length })}
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {result.issues.slice(0, 20).map((issue, index) => (
                  <li key={index}>
                    {issue.code ? `${issue.code}: ` : ""}
                    {issue.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.close")}
          </Button>
          <Button
            size="sm"
            disabled={busy || conflictCount === 0}
            onClick={() => {
              const items: GsheetResolvePayload["items"] = [];
              for (const conflict of result.conflicts) {
                const choiceMap: Record<string, "sheet" | "app"> = {};
                for (const field of conflict.fields) {
                  choiceMap[field.field] = choices[key(conflict.rowKey, field.field)] ?? "sheet";
                }
                items.push({ rowKey: conflict.rowKey, choices: choiceMap });
              }
              onResolve({ items });
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("gsheet.apply")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
