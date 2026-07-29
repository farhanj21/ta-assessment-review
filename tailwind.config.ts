import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral ramp chosen so body text (slate-700 on white) clears WCAG AA
        // at 4.5:1 and muted text (slate-600) still clears it. Nothing lighter
        // than slate-600 is ever used for text — only for borders/dividers.
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          600: '#3155cc', // 5.9:1 on white — safe for text and focus rings
          700: '#2440a0', // 8.1:1 on white — used for primary button text bg
        },
      },
    },
  },
  plugins: [],
};

export default config;
