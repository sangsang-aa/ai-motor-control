/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: '#f7f7f4', soft: '#fafaf7' },
        surface: { card: '#ffffff', strong: '#e6e5e0' },
        ink: '#26251e',
        body: { DEFAULT: '#5a5852', strong: '#26251e' },
        muted: { DEFAULT: '#807d72', soft: '#a09c92' },
        hairline: { DEFAULT: '#e6e5e0', soft: '#efeee8', strong: '#cfcdc4' },
        accent: { DEFAULT: '#f54e00', dim: '#d04200' },
        danger: { DEFAULT: '#cf2d56', dim: '#b5274b' },
        success: '#1f8a65',
        chart: { speed: '#f54e00', current: '#1f8a65', grid: '#e6e5e0', text: '#807d72' }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', pill: '9999px' }
    }
  },
  plugins: []
}
