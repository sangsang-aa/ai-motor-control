/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Industrial control dark blue-gray base — oscilloscope night mode
        bg: {
          base: '#0a1628',    // deepest background
          panel: '#121e33',   // card / sidebar / panel bg
          raised: '#1a2a42',  // elevated surfaces
          hover: '#1f3450',   // hover state
          active: '#253d5e',  // active / selected
          overlay: 'rgba(10, 22, 40, 0.85)' // modal overlay
        },
        line: {
          DEFAULT: '#1e3150',  // subtle borders
          muted: '#152540',    // divider lines
          bright: '#2a4570'    // focus / hover borders
        },
        fg: {
          base: '#e8ecf1',     // primary text
          muted: '#8899aa',    // secondary / meta text
          subtle: '#556677',   // disabled / placeholder
          inverse: '#0a1628'   // text on accent bg
        },
        accent: {
          DEFAULT: '#00a8ff',  // electrical blue — primary accent
          dim: '#0088cc',      // hover / pressed
          glow: '#00a8ff'      // glow effect (same as accent for now)
        },
        danger: {
          DEFAULT: '#ff3b30',  // emergency stop
          dim: '#cc2f26',      // hover
          glow: '#ff3b30'      // glow effect
        },
        warning: {
          DEFAULT: '#ff9500',  // amber — confirm cards
          dim: '#cc7700',      // hover
          bg: 'rgba(255, 149, 0, 0.08)',  // warning bg
          border: 'rgba(255, 149, 0, 0.3)' // warning border
        },
        success: {
          DEFAULT: '#34c759',  // connected / green
          dim: '#28a745',      // hover
          bg: 'rgba(52, 199, 89, 0.1)'  // success bg
        },
        chart: {
          speed: '#00a8ff',    // RPM chart line
          current: '#ff9500',  // current chart line
          grid: 'rgba(255,255,255,0.06)',
          text: '#556677'
        },
        surface: '#121e33',
        'scope-ch1': '#ff6b6b',
        'scope-ch2': '#4ecdc4',
        'scope-ch3': '#45b7d1',
        'scope-ch4': '#f9ca24',
        'scope-ch5': '#6c5ce7',
        'scope-ch6': '#a29bfe',
        'scope-ch7': '#00b894',
        'scope-ch8': '#e17055',
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
