"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

interface PaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const pageItems = Array.from({ length: totalPages }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">
        Menampilkan {start}–{end} dari {totalItems} data
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            Baris per halaman
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
            items={PAGE_SIZE_OPTIONS.map((s) => ({
              value: String(s),
              label: String(s),
            }))}
          >
            <SelectTrigger size="sm" className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="size-4" /> Sebelumnya
        </Button>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Halaman</span>
          <Select
            value={String(currentPage)}
            onValueChange={(v) => onPageChange(Number(v))}
            items={pageItems}
          >
            <SelectTrigger size="sm" className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">/ {totalPages}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Berikutnya <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
