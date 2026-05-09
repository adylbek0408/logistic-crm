export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        className={`px-3 py-2 rounded-lg border text-sm transition-colors outline-none
          ${error ? 'border-danger focus:ring-danger' : 'border-gray-200 focus:border-primary focus:ring-primary'}
          focus:ring-2 focus:ring-offset-0 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
