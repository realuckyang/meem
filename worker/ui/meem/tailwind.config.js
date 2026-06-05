/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        // neon accents
        cyan: { DEFAULT: 'hsl(var(--cyan) / <alpha-value>)', foreground: 'hsl(228 33% 4%)' },
        magenta: 'hsl(var(--magenta) / <alpha-value>)',
        lime: 'hsl(var(--lime) / <alpha-value>)',
        amber: 'hsl(var(--amber) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"SFMono-Regular"', 'ui-monospace', '"JetBrains Mono"', 'Menlo', 'Consolas', '"PingFang SC"', 'monospace'],
        mono: ['"SFMono-Regular"', 'ui-monospace', 'Menlo', 'Consolas', '"PingFang SC"', 'monospace'],
      },
      maxWidth: {
        read: '760px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.4), 0 12px 36px -16px rgba(0,0,0,.7)',
        glow: '0 0 12px hsl(187 100% 58% / .5)',
        'glow-sm': '0 0 8px hsl(187 100% 58% / .4)',
        'glow-lg': '0 0 0 1px hsl(187 100% 58% / .35), 0 0 22px hsl(187 100% 58% / .45)',
      },
      keyframes: {
        'neon-blink': { '50%': { opacity: '0' } },
        'neon-rise': { from: { opacity: '0', transform: 'translateY(8px)' } },
      },
      animation: {
        'neon-blink': 'neon-blink 1s steps(1) infinite',
        'neon-rise': 'neon-rise .35s ease both',
      },
    },
  },
  plugins: [],
};
