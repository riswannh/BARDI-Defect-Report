import { Info } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Pembungkus beberapa kartu ringkasan menjadi satu section berjudul (card
 * nesting): latar memakai tint primary (teal BARDI) + ring supaya sectionnya
 * kontras dari kartu putih di dalamnya. Section memakai lebar penuh grid
 * (`col-span-2`). Padding/jarak dibuat lebih rapat daripada kartunya supaya
 * proporsinya pas dengan kartu yang sudah dipadatkan.
 *
 * Isi section = sampai 3 kartu sebaris (`basis-[30%]` + `flex-1`). Kalau
 * jumlahnya kurang dari 3, kartu melebar mengisi sisa lebar section; kalau
 * lebih (4-5), sisanya turun ke baris berikutnya dan tetap melebar penuh —
 * jadi tidak pernah ada lubang kosong di kanan.
 *
 * `panel` mengubah bentuknya jadi konsep "single stacked column": judul kecil
 * HURUF KAPITAL, lalu SATU panel putih berisi beberapa `StatItem` sebaris
 * (label kecil + nilai besar + garis pemisah), bukan kartu-kartu terpisah.
 */
export function SummarySection({
  title,
  children,
  panel = false,
}: {
  title: string;
  children: ReactNode;
  panel?: boolean;
}) {
  return (
    <section
      className={`col-span-2 rounded-2xl p-3 ring-1 ${
        panel ? "bg-primary/20 ring-primary/35" : "bg-primary/15 ring-primary/40"
      }`}
    >
      <h3
        className={`mb-2 font-heading font-semibold text-primary ${
          panel ? "text-[11px] uppercase tracking-[0.14em]" : "text-[13px]"
        }`}
      >
        {title}
      </h3>
      <div
        className={
          panel
            ? "flex flex-wrap items-stretch gap-y-3 rounded-xl bg-background px-4 py-3 shadow-sm ring-1 ring-primary/10 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-40"
            : "flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[30%]"
        }
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Satu angka di dalam panel putih `SummarySection panel`: label kecil huruf
 * kapital + ikon, nilai besar berwarna primary, keterangan disembunyikan di
 * balik ikon (i) — sama seperti `SummaryCard`, tapi tanpa kartu sendiri supaya
 * beberapa angka bisa berbagi satu panel dan dipisah garis vertikal.
 */
export function StatItem({
  label,
  value,
  description,
  icon: Icon,
  valueClassName = "text-primary",
}: {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 [&:first-child]:pl-0 [&:last-child]:pr-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-primary/15">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {Icon && <Icon className="size-3 shrink-0 text-primary/70" />}
        <span className="truncate">{label}</span>
        {description && (
          <span
            className="group/info relative inline-flex shrink-0 cursor-help text-muted-foreground/50 hover:text-muted-foreground"
            title={description}
            tabIndex={0}
          >
            <Info className="size-3" aria-hidden />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-56 -translate-x-1/2 rounded-md bg-popover px-2.5 py-1.5 text-[11px] leading-snug font-normal normal-case tracking-normal text-popover-foreground shadow-md ring-1 ring-foreground/10 group-hover/info:block group-focus-within/info:block"
            >
              {description}
            </span>
          </span>
        )}
      </span>
      <span
        className={`font-heading text-xl font-semibold tracking-tight break-words tabular-nums ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}
