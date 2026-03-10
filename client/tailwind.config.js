/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        card: {
          red:    '#e74c3c',
          green:  '#27ae60',
          blue:   '#2980b9',
          yellow: '#f1c40f',
          wild:   '#8e44ad',
        },
        bg: {
          dark:  '#1a1a2e',
          panel: '#16213e',
          card:  '#0f3460',
        },
      },
      animation: {
        'card-play':    'cardPlay 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        'card-draw':    'cardDraw 0.3s ease-out',
        'card-lift':    'cardLift 0.2s ease-out forwards',
        'shake':        'shake 0.45s ease-in-out',
        'pulse-red':    'pulseRed 1s ease-in-out infinite',
        'bounce-in':    'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        'slide-up':     'slideUp 0.3s ease-out',
        'fade-in':      'fadeIn 0.2s ease-out',
        'fade-in-down': 'fadeInDown 0.25s ease-out',
        'spin-slow':    'spin 3s linear infinite',
        'glow-red':     'glowRed 1.2s ease-in-out infinite',
        'float':        'float 2.5s ease-in-out infinite',
        'deal':         'deal 0.4s ease-out',
        'eliminated':   'eliminated 0.5s ease-in forwards',
      },
      keyframes: {
        cardPlay: {
          '0%':   { transform: 'translateY(0) scale(1)', opacity: '1' },
          '40%':  { transform: 'translateY(-32px) scale(1.15)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        cardDraw: {
          '0%':   { transform: 'translateX(-20px) scale(0.8)', opacity: '0' },
          '100%': { transform: 'translateX(0) scale(1)', opacity: '1' },
        },
        cardLift: {
          '0%':   { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-16px)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0) rotate(0deg)' },
          '20%':     { transform: 'translateX(-6px) rotate(-2deg)' },
          '40%':     { transform: 'translateX(6px) rotate(2deg)' },
          '60%':     { transform: 'translateX(-4px) rotate(-1deg)' },
          '80%':     { transform: 'translateX(4px) rotate(1deg)' },
        },
        pulseRed: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(231,76,60,0.5)' },
          '50%':     { boxShadow: '0 0 0 10px rgba(231,76,60,0)' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.5)', opacity: '0' },
          '60%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInDown: {
          '0%':   { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowRed: {
          '0%,100%': { filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.4))' },
          '50%':     { filter: 'drop-shadow(0 0 12px rgba(239,68,68,0.9))' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
        deal: {
          '0%':   { transform: 'translateY(-60px) rotate(-5deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
        },
        eliminated: {
          '0%':   { transform: 'scale(1)', opacity: '1' },
          '30%':  { transform: 'scale(1.1) rotate(3deg)' },
          '100%': { transform: 'scale(0) rotate(15deg)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
