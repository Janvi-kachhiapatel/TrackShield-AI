/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        railway: {
          50: '#F0F5FA',
          100: '#DFEAF5',
          200: '#BED4EC',
          300: '#92B7DF',
          400: '#5F95CE',
          500: '#3875B8',
          600: '#275B97',
          700: '#1F4777',
          800: '#18385E',
          900: '#0F2742',
          950: '#0B1C30',
          dark: '#0B2F58',
          accent: '#0F3C6E',
          gold: '#D4AF37'
        },
        status: {
          critical: '#DC2626',
          warning: '#D97706',
          success: '#16A34A',
          info: '#2563EB',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
