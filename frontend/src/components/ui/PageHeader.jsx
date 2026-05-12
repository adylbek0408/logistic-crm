export function PageHeader({ title, subtitle, actions, compact = false }) {
  return (
    <header className={`flex flex-col gap-3 md:flex-row md:items-start md:justify-between ${compact ? 'mb-1' : 'mb-2'}`}>
      <div className="min-w-0">
        <h1 className="text-mobile-title md:text-[26px] leading-tight font-bold text-primary truncate">{title}</h1>
        {subtitle && <p className="text-mobile-subtitle text-neutral-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">{actions}</div>}
    </header>
  )
}
