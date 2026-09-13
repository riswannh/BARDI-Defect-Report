import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
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
        <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </CardContent>
    </Card>
  );
}
