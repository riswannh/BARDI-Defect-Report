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
 */
export function SummarySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="col-span-2 rounded-2xl bg-primary/15 p-3 ring-1 ring-primary/40">
      <h3 className="mb-2 font-heading text-[13px] font-semibold text-primary">
        {title}
      </h3>
      <div className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[30%]">
        {children}
      </div>
    </section>
  );
}
