import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Kartu ringkasan yang dipadatkan: padding 12 px (Card size="sm"), ikon 28 px,
 * judul 13 px, dan ukuran huruf nilai mengikuti LEBAR kartu lewat container
 * query (bukan panjang teks) supaya tetap proporsional: 18 px di kartu sempit
 * (grid 3 kolom Defect/Sales/PO), 20 px di kartu Report (± 640 px), 24 px kalau
 * kartunya lebar. `break-words` tetap dipasang sebagai jaring terakhir supaya
 * tidak ada angka yang hilang.
 */
export function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: SummaryCardProps) {
  return (
    <Card size="sm" className="@container relative overflow-hidden rounded-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
              <Icon className="size-3.5" />
            </span>
          )}
          {/* Ukuran judul dipaksa 13 px lewat style: varian
              `group-data-[size=sm]/card:text-sm` bawaan Card lebih kuat
              spesifisitasnya daripada class utility biasa. */}
          <CardTitle
            className="leading-tight text-muted-foreground"
            style={{ fontSize: "13px" }}
          >
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        <span className="font-heading text-lg font-semibold tracking-tight break-words tabular-nums @[22rem]:text-xl @[30rem]:text-[22px]">
          {value}
        </span>
        {description && (
          <span className="text-[11px] leading-tight text-muted-foreground">
            {description}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
