export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none'
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-500 active:translate-y-px focus-visible:ring-primary',
    secondary: 'bg-white text-primary border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 active:translate-y-px focus-visible:ring-primary',
    danger: 'bg-danger text-white hover:bg-rose-600 active:translate-y-px focus-visible:ring-danger',
    ghost: 'text-neutral-600 hover:bg-neutral-100 focus-visible:ring-neutral-400',
    accent: 'bg-accent text-white hover:bg-amber-500 active:translate-y-px focus-visible:ring-accent',
  }
  const sizes = {
    sm: 'min-h-touch px-3 text-sm gap-1.5',
    md: 'min-h-touch px-4 text-sm gap-2',
    lg: 'min-h-touch px-5 text-sm gap-2',
  }
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}
