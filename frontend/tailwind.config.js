/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0B10',
        charcoal: '#14151D',
        panel: '#181A24',
        rose: {
          DEFAULT: '#FF4D7D',
          soft: '#FF7DA0',
          deep: '#D93A68',
        },
        orchid: '#A78BFA',
        pearl: '#F3F1F7',
        mist: '#8B8D9B',
        mint: '#4ADE80',
        coral: '#FB7185',
        sky: '#38BDF8',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
      backgroundImage: {
        'rose-orchid': 'linear-gradient(135deg, #FF4D7D 0%, #A78BFA 100%)',
        'ambient-glow': 'radial-gradient(circle at 30% 20%, rgba(255,77,125,0.18), transparent 45%), radial-gradient(circle at 80% 70%, rgba(167,139,250,0.16), transparent 45%)',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.45)',
        glow: '0 0 40px rgba(255,77,125,0.35)',
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        'fade-up': 'fadeUp 0.5s ease forwards',
        'fade-in': 'fadeIn 0.4s ease forwards',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 30px rgba(255,77,125,0.35)' },
          '50%': { transform: 'scale(1.06)', boxShadow: '0 0 55px rgba(255,77,125,0.55)' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(14px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
      },
    },
  },
  plugins: [],
};
