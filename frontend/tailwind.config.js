/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Cascadia Code',
          'Consolas',
          'Sarasa Mono SC',
          'Source Han Mono SC',
          'ui-monospace',
          'monospace',
        ],
      },
      colors: {
        ink: {
          950: '#070708',
          900: '#0a0a0b',
          850: '#101013',
          800: '#16161a',
          750: '#1a1a20',
          700: '#202028',
          600: '#2a2a35',
          500: '#3a3a48',
        },
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        pulseSoft: 'pulseSoft 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
