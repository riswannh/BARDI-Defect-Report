import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Nilai rupiah bisa panjang ("Rp 1.234.567.890") sementara di halaman Report
 * kartunya hanya selebar ~240 px pada grid 6 kolom, sehingga teksnya dulu
 * terpotong. Ukuran hurufnya turun satu tingkat setiap nilainya bertambah panjang,
 * dan `break-words` dipasang sebagai jaring terakhir supaya tidak ada yang hilang.
 */
function valueTextClass(value: React.ReactNode) {
  const text =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (text.length >= 18) return "text-base";
  if (text.length >= 15) return "text-lg";
  if (text.length >= 12) return "text-xl";
  return "text-2xl";
}

export function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: SummaryCardProps) {
  return (
    <Card size="sm" className="relative overflow-hidden">
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
          className={`font-heading font-semibold tracking-tight break-words tabular-nums ${valueTextClass(value)}`}
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
