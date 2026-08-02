export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-semibold text-ink">{title}</h1>
        {subtitle && <div className="mt-1 text-[13px] text-secondary">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}
