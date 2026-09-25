import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Ukuran huruf nilai mengikuti LEBAR kartu lewat container query, bukan panjang
 * teks: di grid 2 kolom halaman Report kartunya lebar (± 640 px) sehingga angka
 * panjang pun tetap besar dan tidak menyisakan ruang kosong, sementara di grid
 * 3 kolom (Defect/Sales/PO) ukurannya seperti sebelumnya. `break-words` tetap
 * dipasang sebagai jaring terakhir supaya tidak ada angka yang hilang.
 */
export function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: SummaryCardProps) {
  return (
    <Card size="sm" className="@container relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Icon className="size-4" />
            </span>
          )}
          <CardTitle className="text-muted-foreground">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        <span
          className="font-heading text-xl font-semibold tracking-tight break-words tabular-nums @[22rem]:text-2xl @[30rem]:text-3xl"
        >
          {value}
        </span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </CardContent>
    </Card>
  );
}
