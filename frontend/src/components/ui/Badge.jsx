const TONES = {
  neutral: 'bg-neutral-100 text-neutral-600',
  info: 'bg-blue-50 text-blue-700',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700',
  danger: 'bg-rose-50 text-rose-700',
}

const SIZES = {
  sm: 'h-5 px-2 text-[11px]',
  md: 'h-6 px-2.5 text-xs',
}

export function Badge({ children, className = '', tone = 'neutral', size = 'md', dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${TONES[tone] || TONES.neutral} ${SIZES[size] || SIZES.md} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}
