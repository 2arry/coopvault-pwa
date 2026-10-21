/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (see src/style.css) so light and dark themes share one set of class names.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        paper: v('paper'),
        card: v('card'),
        sunk: v('sunk'),
        line: v('line'),
        ink: { DEFAULT: v('ink'), soft: v('ink-soft'), faint: v('ink-faint') },
        brand: { DEFAULT: v('brand'), strong: v('brand-strong'), soft: v('brand-soft'), ink: v('brand-ink'), text: v('brand-text') },
        gold: { DEFAULT: v('gold'), soft: v('gold-soft'), text: v('gold-text') },
        pos: { DEFAULT: v('pos'), soft: v('pos-soft') },
        warn: { DEFAULT: v('warn'), soft: v('warn-soft') },
        neg: { DEFAULT: v('neg'), soft: v('neg-soft') },
        info: { DEFAULT: v('info'), soft: v('info-soft') },
        // Fixed brand surfaces (hero cards, landing) that look the same in both themes
        forest: { 950: '#04190f', 900: '#06261c', 800: '#0b3d2e', 700: '#11503c', 600: '#1a6a4f', 300: '#9fd4bb', 100: '#dcefe5' },
        coin: { 500: '#e2b04a', 400: '#ebc26a', 300: '#f3d796' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'Cambria', 'serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        soft: '0 1px 2px rgb(16 32 24 / 0.04), 0 10px 30px -18px rgb(16 32 24 / 0.18)',
        lift: '0 2px 4px rgb(16 32 24 / 0.05), 0 24px 48px -24px rgb(16 32 24 / 0.35)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(10px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
      },
      animation: { pop: 'pop .5s cubic-bezier(.2,.9,.3,1.2) both', rise: 'rise .5s ease-out both' },
    },
  },
  plugins: [],
}
