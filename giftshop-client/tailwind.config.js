/** Colours come from CSS variables (see src/index.css) so light and dark mode share one set of class names. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        brand: v('brand'), // Plum Velvet
        'brand-ink': v('brand-ink'), // text on brand
        accent: v('accent'), // deep rose, for text and buttons
        rose: '#C77486', // Rosewood, for fills only
        sage: '#A8B89A',
        'sage-ink': v('sage-ink'),
        lavender: '#A7B0D6',
        danger: v('danger'), // errors only
        'lavender-ink': v('lavender-ink'),
        cream: '#F4E1D2',
        plum: '#5E3A4D',
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '14px' },
      maxWidth: { page: '1200px' },
    },
  },
  plugins: [],
};
