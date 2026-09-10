import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardProps {
  title: string;
  value: string;
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
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        <span className="font-heading text-xl font-semibold">{value}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </CardContent>
    </Card>
  );
}
