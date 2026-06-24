import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          primary: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a2e',
        },
        accent: {
          primary: '#3b82f6',   // blue-500
          secondary: '#10b981', // emerald-500
          hover: '#60a5fa',     // blue-400
        },
        status: {
          running: '#3b82f6',   // blue
          completed: '#22c55e', // green
          failed: '#ef4444',    // red
          warning: '#eab308',   // yellow
          pending: '#6b7280',   // gray
        },
        gauge: {
          low: '#22c55e',       // green, below 60%
          medium: '#eab308',    // yellow, 60-85%
          high: '#ef4444',      // red, above 85%
        },
        text: {
          primary: '#f8fafc',
          secondary: '#cbd5e1',
          muted: '#64748b',
        },
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      screens: {
        mobile: '320px',
        tablet: '768px',
        desktop: '1024px',
        wide: '1440px',
        ultrawide: '2560px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-in': 'slideIn 300ms ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'ease-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '300ms',
        slow: '400ms',
      },
    },
  },
  plugins: [],
  // RTL variant support
  variants: {
    extend: {
      margin: ['rtl'],
      padding: ['rtl'],
      textAlign: ['rtl'],
      float: ['rtl'],
      inset: ['rtl'],
    },
  },
};

export default config;
