export function DataTable({ columns, children, className = '' }) {
  return (
    <div className={`overflow-x-auto rounded-2xl ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-400 uppercase tracking-wider bg-neutral-50">
            {columns.map((col) => (
              <th key={col.key} className={`px-6 py-3 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  )
}
