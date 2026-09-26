/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Codex 近黑中性主题(feature/image 重绘;与 app/globals.css 的 --cx-* 对齐)
        bg: {
          base: '#0a0a0a',
          panel: '#0f0f0f',
          raised: '#141414',
          hover: '#1e1e1e',
          active: '#242424',
          overlay: 'rgba(0, 0, 0, 0.72)'
        },
        line: {
          DEFAULT: '#1c1c1c',
          muted: '#161616',
          bright: '#2a2a2a'
        },
        fg: {
          base: '#ececec',
          muted: '#9a9a9a',
          subtle: '#6a6a6a',
          inverse: '#0a0a0a'
        },
        accent: {
          DEFAULT: '#e8e8e8',
          dim: '#cfcfcf',
          glow: '#e8e8e8'
        },
        danger: { DEFAULT: '#ff5f57', dim: '#cc4b44', glow: '#ff5f57' },
        warning: { DEFAULT: '#febc2e', dim: '#d99a1e', bg: 'rgba(254,188,46,0.08)', border: 'rgba(254,188,46,0.3)' },
        success: { DEFAULT: '#3fb950', dim: '#2f9e3f', bg: 'rgba(63,185,80,0.1)' },
        chart: { speed: '#4ea1ff', current: '#ffb340', grid: 'rgba(255,255,255,0.06)', text: '#6a6a6a' },
        surface: '#141414',
        'surface-lighter': '#1e1e1e',
        'surface-light': '#1a1a1a',
        'text-primary': '#ececec',
        'text-secondary': '#9a9a9a',
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
