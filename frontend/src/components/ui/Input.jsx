export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <input
        className={`min-h-touch px-3 rounded-xl border bg-white text-sm transition-colors outline-none
          ${error ? 'border-danger focus-visible:ring-danger/25' : 'border-neutral-200 hover:border-neutral-300 focus-visible:border-primary focus-visible:ring-primary/20'}
          focus-visible:ring-2 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
