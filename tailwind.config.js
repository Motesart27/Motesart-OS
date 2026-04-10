/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* ── Emergent Color Palette ── */
      colors: {
        bg: {
          DEFAULT: '#0f0a1a',
          deep: '#0a0612',
          card: 'rgba(255, 255, 255, 0.06)',
          'card-hover': 'rgba(255, 255, 255, 0.10)',
          input: 'rgba(255, 255, 255, 0.08)',
        },
        brand: {
          purple: '#a855f7',
          'purple-light': '#c084fc',
          'purple-dark': '#7c3aed',
          pink: '#ec4899',
          'pink-light': '#f472b6',
          fuchsia: '#d946ef',
          teal: '#14b8a6',
          'teal-light': '#2dd4bf',
          'teal-dark': '#0d9488',
          amber: '#fbbf24',
          'amber-light': '#fcd34d',
        },
        status: {
          critical: '#ef4444',
          'at-risk': '#f97316',
          watch: '#fbbf24',
          'on-track': '#22c55e',
          info: '#3b82f6',
        },
        dpm: {
          drive: '#3b82f6',
          passion: '#f97316',
          motivation: '#22c55e',
        },
      },

      /* ── Typography ── */
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },

      /* ── Animations ── */
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'spin-reverse': 'spinReverse 5s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        spinReverse: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },

      /* ── Spacing & Sizing ── */
      borderRadius: {
        'card': '16px',
        'btn': '12px',
      },
      backdropBlur: {
        'card': '20px',
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.3)',
        'glow-teal': '0 0 20px rgba(20, 184, 166, 0.3)',
        'glow-pink': '0 0 20px rgba(236, 72, 153, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
