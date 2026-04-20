import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        ink: '#0B1627',
        ink2: '#1E2F47',
        ink3: '#4A6380',
        ink4: '#8FA3B8',
        surface: '#F0F4FA',
        surface2: '#E2EAF5',
        navy: '#050c1a',
        'navy-2': '#060d1a',
        blue: {
          DEFAULT: '#1D4ED8',
          dark: '#1539B2',
          mid: '#3B82F6',
          light: '#93C5FD',
          bg: '#EFF6FF',
          border: '#BFDBFE',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        stepIn: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        orb: { from: { transform: 'scale(1) translate(0,0)' }, to: { transform: 'scale(1.15) translate(20px,-20px)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        stepIn: 'stepIn 0.2s ease both',
        orb: 'orb 12s ease-in-out infinite alternate',
        'orb-rev': 'orb 16s ease-in-out infinite alternate-reverse',
      },
      boxShadow: {
        card: '0 2px 8px rgba(11,22,39,.05),0 1px 2px rgba(11,22,39,.04)',
        'card-md': '0 4px 20px rgba(11,22,39,.09),0 1px 6px rgba(11,22,39,.04)',
        'card-lg': '0 16px 48px rgba(11,22,39,.13),0 4px 16px rgba(11,22,39,.07)',
      },
    },
  },
  plugins: [animate],
}

export default config
