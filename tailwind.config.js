/** @type {import('tailwindcss').Config} */
// Dark mode is hard-coded on <html class="dark">. There is deliberately no
// light theme. Design tokens live as CSS variables in src/css/input.css and are
// surfaced to Tailwind here so utilities like bg-surface / text-sun stay in sync.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // rgb(var() / <alpha-value>) keeps Tailwind opacity modifiers working.
        // Night-sky base + layered surfaces
        base: 'rgb(var(--c-base) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--c-surface-1) / <alpha-value>)',
          2: 'rgb(var(--c-surface-2) / <alpha-value>)',
          3: 'rgb(var(--c-surface-3) / <alpha-value>)',
        },
        line: 'rgb(var(--c-line) / <alpha-value>)',
        // Celestial symbol accents
        sun: 'rgb(var(--c-sun) / <alpha-value>)',
        moon: 'rgb(var(--c-moon) / <alpha-value>)',
        // Reserved semantic colors — red ONLY for violations, green ONLY for confirmations
        violation: 'rgb(var(--c-violation) / <alpha-value>)',
        confirm: 'rgb(var(--c-confirm) / <alpha-value>)',
        // Text
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          muted: 'rgb(var(--c-ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--c-ink-faint) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['"IBM Plex Sans"', 'ui-sans-serif', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        cell: 'var(--r-cell)',
      },
      boxShadow: {
        'sun-glow': '0 0 20px -4px var(--glow-sun)',
        'moon-glow': '0 0 20px -4px var(--glow-moon)',
        panel: '0 24px 60px -20px rgba(0,0,0,0.7)',
      },
      transitionTimingFunction: {
        celestial: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
