export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-500 focus:ring-primary',
    secondary: 'bg-white text-primary border border-gray-200 hover:bg-gray-50 focus:ring-primary',
    danger: 'bg-danger text-white hover:bg-red-600 focus:ring-danger',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
    accent: 'bg-accent text-white hover:bg-amber-500 focus:ring-accent',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  }
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}
