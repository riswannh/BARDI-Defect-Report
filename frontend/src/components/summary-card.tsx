import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: React.ReactNode;
  /** Keterangan kartu — tampil sebagai popup dari ikon (i) di kanan judul. */
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Tombol/menu kecil di kanan atas kartu (mis. "Atur kurs" pada Total Value PO). */
  action?: React.ReactNode;
}

/**
 * Kartu ringkasan padat: padding 12 px (Card size="sm"), ikon 24 px, judul
 * 12 px, dan ukuran huruf nilai mengikuti LEBAR kartu lewat container query
 * (bukan panjang teks) supaya tetap proporsional: 16 px di kartu sempit
 * (grid 3 kolom Defect/Sales/PO), 18 px di kartu Report, 20 px kalau kartunya
 * lebar. Keterangan tidak lagi memakan baris di badan kartu, tapi disembunyikan
 * di balik ikon (i) di kanan judul — popup CSS murni (muncul saat ikon
 * di-hover atau difokus keyboard), plus atribut `title` sebagai jaring
 * pengaman/aksesibilitas. `overflow-hidden` sengaja TIDAK dipakai supaya
 * popupnya tidak terpotong tepi kartu. `break-words` tetap dipasang supaya
 * tidak ada angka yang hilang.
 */
export function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  action,
}: SummaryCardProps) {
  return (
    <Card size="sm" className="@container relative rounded-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
              <Icon className="size-3" />
            </span>
          )}
          {/* Ukuran judul dipaksa 12 px lewat style: varian
              `group-data-[size=sm]/card:text-sm` bawaan Card lebih kuat
              spesifisitasnya daripada class utility biasa. */}
          <CardTitle
            className="flex min-w-0 items-center gap-1 leading-tight text-muted-foreground"
            style={{ fontSize: "12px" }}
          >
            <span className="truncate">{title}</span>
            {description && (
              <span
                className="group/info relative inline-flex shrink-0 cursor-help text-muted-foreground/60 hover:text-muted-foreground"
                title={description}
                tabIndex={0}
              >
                <Info className="size-3.5" aria-hidden />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-56 -translate-x-1/2 rounded-md bg-popover px-2.5 py-1.5 text-[11px] leading-snug font-normal text-popover-foreground shadow-md ring-1 ring-foreground/10 group-hover/info:block group-focus-within/info:block"
                >
                  {description}
                </span>
              </span>
            )}
          </CardTitle>
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        <span className="font-heading text-base font-semibold tracking-tight break-words tabular-nums @[22rem]:text-lg @[30rem]:text-xl">
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
