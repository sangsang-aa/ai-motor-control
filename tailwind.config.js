/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Altior 近黑主题(与 DESIGN.md 对齐)
        bg: {
          base: '#0d0d0d',
          panel: '#121212',
          raised: '#1c1c1c',
          hover: '#1f1f1f',
          active: '#2a2a2a',
          overlay: 'rgba(13, 13, 13, 0.75)'
        },
        line: {
          DEFAULT: '#2a2a2a',
          muted: '#1f1f1f',
          bright: '#333333'
        },
        fg: {
          base: '#ececec',
          muted: '#9aa0a6',
          subtle: '#6b7075',
          inverse: '#0d0d0d'
        },
        accent: {
          DEFAULT: '#2bb8a8',
          dim: '#26a69a',
          glow: '#2bb8a8'
        },
        danger: { DEFAULT: '#ff3b30', dim: '#cc2f26', glow: '#ff3b30' },
        warning: { DEFAULT: '#ff9500', dim: '#cc7700', bg: 'rgba(255,149,0,0.08)', border: 'rgba(255,149,0,0.3)' },
        success: { DEFAULT: '#2bb8a8', dim: '#26a69a', bg: 'rgba(43,184,168,0.1)' },
        chart: { speed: '#2bb8a8', current: '#2f6bff', grid: 'rgba(255,255,255,0.06)', text: '#6b7075' },
        surface: '#121212',
        'surface-lighter': '#1f1f1f',
        'surface-light': '#1c1c1c',
        'text-text-primary': '#ececec',
        'text-text-secondary': '#9aa0a6',
        'scope-ch1': '#ff6b6b', 'scope-ch2': '#4ecdc4', 'scope-ch3': '#45b7d1',
        'scope-ch4': '#f9ca24', 'scope-ch5': '#6c5ce7', 'scope-ch6': '#a29bfe',
        'scope-ch7': '#00b894', 'scope-ch8': '#e17055',
      },
      fontFamily: {
        sans: [
          'Noto Sans SC',
          'WenQuanYi Micro Hei',
          'Microsoft YaHei',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'Cascadia Code',
          'Fira Code',
          'Consolas',
          'monospace'
        ]
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'slide-in-left': 'slide-in-left 0.25s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'countdown': 'countdown 30s linear forwards'
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 }
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(255, 59, 48, 0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 59, 48, 0.8)' }
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      }
    }
  },
  plugins: []
}
