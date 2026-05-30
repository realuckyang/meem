/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"PingFang SC"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        site: '0 18px 60px -38px rgba(20,28,43,.45)',
      },
    },
  },
  plugins: [],
};
