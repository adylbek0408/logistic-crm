import { Button } from './Button'

export function FilterBar({ open, children, onReset, className = '' }) {
  if (!open) return null

  return (
    <section className={`panel p-4 ${className}`}>
      <div className="flex flex-wrap gap-3 items-end">
        {children}
        <Button variant="secondary" size="md" onClick={onReset} className="w-full sm:w-auto">
          Сбросить
        </Button>
      </div>
    </section>
  )
}
