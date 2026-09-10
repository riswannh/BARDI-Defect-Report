"use client";

import { useLanguage } from "@/lib/i18n";
import type { ImportResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

interface ImportResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ImportResult | null;
}

function downloadCsv(result: ImportResult) {
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const lines = ["Status,Baris,Data,Alasan"];
  for (const issue of result.errors) {
    lines.push(
      ["ERROR", issue.row, issue.key, issue.reason].map(escape).join(",")
    );
  }
  for (const issue of result.skippedDetails) {
    lines.push(
      ["DILEWATI", issue.row, issue.key, issue.reason].map(escape).join(",")
    );
  }
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan-import-${result.module}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportResultDialog({
  open,
  onOpenChange,
  result,
}: ImportResultDialogProps) {
  const { t } = useLanguage();

  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>
            {t("import.description", { total: result.totalRows })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">
              {t("import.totalRows")}
            </div>
            <div className="text-lg font-semibold">{result.totalRows}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="text-xs text-muted-foreground">
              {t("import.inserted")}
            </div>
            <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {result.inserted}
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="text-xs text-muted-foreground">
              {t("import.skipped")}
            </div>
            <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              {result.skipped}
            </div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <div className="text-xs text-muted-foreground">
              {t("import.errors")}
            </div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              {result.errors.length}
            </div>
          </div>
        </div>

        <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
          <div>
            <div className="mb-2 text-sm font-medium">
              {t("import.errorSection")}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("import.row")}</TableHead>
                  <TableHead className="w-40">{t("import.key")}</TableHead>
                  <TableHead>{t("import.reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((issue, index) => (
                  <TableRow key={`err-${index}`}>
                    <TableCell className="tabular-nums">{issue.row}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {issue.key || "-"}
                    </TableCell>
                    <TableCell className="whitespace-normal text-red-600 dark:text-red-400">
                      {issue.reason}
                    </TableCell>
                  </TableRow>
                ))}
                {result.errors.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-4 text-center text-muted-foreground"
                    >
                      {t("import.noErrors")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {result.skippedDetails.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">
                {t("import.skippedSection")}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("import.row")}</TableHead>
                    <TableHead className="w-40">{t("import.key")}</TableHead>
                    <TableHead>{t("import.reason")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.skippedDetails.map((issue, index) => (
                    <TableRow key={`skip-${index}`}>
                      <TableCell className="tabular-nums">
                        {issue.row}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {issue.key || "-"}
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {issue.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className="text-xs">
            {t("import.serverLogHint")}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(result)}
          >
            <Download className="size-4" /> {t("import.downloadReport")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
