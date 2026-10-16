import type { ReactNode } from "react";

/**
 * Pembungkus beberapa kartu ringkasan menjadi satu section berjudul (card
 * nesting): latar memakai tint primary (teal BARDI) + ring supaya sectionnya
 * kontras dari kartu putih di dalamnya. Section memakai lebar penuh grid
 * (`col-span-2`) dan isinya grid 2 kolom, jadi ukuran kartu di dalamnya sama
 * seperti kartu yang berdiri sendiri.
 */
export function SummarySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="col-span-2 rounded-2xl bg-primary/15 p-4 ring-1 ring-primary/40">
      <h3 className="mb-3 font-heading text-sm font-semibold text-primary">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </section>
  );
}
