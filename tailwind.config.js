/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Codex 亮/暗双主题(与 app/globals.css 的 --cx-* 对齐;accent 用 RGB 以支持 /透明度)
        bg: {
          base: 'var(--cx-bg)',
          panel: 'var(--cx-bg-elev)',
          raised: 'var(--cx-surface)',
          hover: 'var(--cx-hover)',
          active: 'var(--cx-active)',
          overlay: 'var(--cx-overlay)'
        },
        line: {
          DEFAULT: 'var(--cx-border)',
          muted: 'var(--cx-border-muted)',
          bright: 'var(--cx-border-2)'
        },
        fg: {
          base: 'var(--cx-text)',
          muted: 'var(--cx-muted)',
          subtle: 'var(--cx-subtle)',
          inverse: 'var(--cx-bg)'
        },
        accent: {
          DEFAULT: 'rgb(var(--cx-accent-rgb) / <alpha-value>)',
          dim: 'var(--cx-accent-dim)',
          glow: 'var(--cx-accent)'
        },
        danger: { DEFAULT: 'var(--cx-danger)', dim: 'var(--cx-danger-dim)', glow: 'var(--cx-danger)' },
        warning: { DEFAULT: 'var(--cx-warning)', dim: 'var(--cx-warning-dim)', bg: 'var(--cx-warning-bg)', border: 'var(--cx-warning-border)' },
        success: { DEFAULT: 'var(--cx-success)', dim: 'var(--cx-success-dim)', bg: 'var(--cx-success-bg)' },
        chart: { speed: 'var(--cx-chart-speed)', current: 'var(--cx-chart-current)', grid: 'var(--cx-chart-grid)', text: 'var(--cx-chart-text)' },
        surface: 'var(--cx-surface)',
        'surface-lighter': 'var(--cx-hover)',
        'surface-light': 'var(--cx-surface-2)',
        'text-primary': 'var(--cx-text)',
        'text-secondary': 'var(--cx-muted)',
        'scope-ch1': 'var(--cx-ch1)', 'scope-ch2': 'var(--cx-ch2)', 'scope-ch3': 'var(--cx-ch3)',
        'scope-ch4': 'var(--cx-ch4)', 'scope-ch5': 'var(--cx-ch5)', 'scope-ch6': 'var(--cx-ch6)',
        'scope-ch7': 'var(--cx-ch7)', 'scope-ch8': 'var(--cx-ch8)',
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
