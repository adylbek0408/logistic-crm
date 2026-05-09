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
    },
  },
  plugins: [],
}
