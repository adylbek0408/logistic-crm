/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E1B4B',
          50: '#EEEDF7',
          100: '#D0CEF0',
          500: '#4B47A0',
          700: '#1E1B4B',
          900: '#0D0C22',
        },
        neutral: {
          25: '#FCFDFE',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
        },
        accent: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
        },
        success: '#10B981',
        danger: '#F43F5E',
        surface: '#F8FAFC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      fontSize: {
        'mobile-title': ['1.25rem', { lineHeight: '1.35', fontWeight: '700', letterSpacing: '-0.01em' }],
        'mobile-subtitle': ['0.9375rem', { lineHeight: '1.45', fontWeight: '500' }],
        'mobile-body': ['0.875rem', { lineHeight: '1.45', fontWeight: '500' }],
        'mobile-meta': ['0.75rem', { lineHeight: '1.35', fontWeight: '500' }],
      },
      spacing: {
        page: '1rem',
        section: '1rem',
        stack: '0.75rem',
      },
      minHeight: {
        touch: '44px',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
}
