interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="animate-fade-in-up mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary via-primary/70 to-primary/20"
        />
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="animate-fade-in-soft flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
