/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary: Calm Teal
        primary: {
          DEFAULT: '#0D9488', // Teal 600
          dark: '#14B8A6',    // Teal 500
          container: '#F0FDFA', // Teal 50
          'container-dark': '#134E4A' // Teal 900
        },
        // Secondary / Accent: Warm Amber (Streak & Momentum)
        accent: {
          DEFAULT: '#D97706', // Amber 600
          dark: '#F59E0B',    // Amber 500
          container: '#FEF3C7', // Amber 100
          'container-dark': '#78350F' // Amber 900
        },
        // Semantic Category Colors
        category: {
          health: '#059669',
          'health-dark': '#34D399',
          'health-surface': '#ECFDF5',
          'health-surface-dark': '#064E3B',

          career: '#4F46E5',
          'career-dark': '#818CF8',
          'career-surface': '#EEF2FF',
          'career-surface-dark': '#1E1B4B',

          mind: '#0284C7',
          'mind-dark': '#38BDF8',
          'mind-surface': '#F0F9FF',
          'mind-surface-dark': '#0C4A6E',

          fitness: '#E11D48',
          'fitness-dark': '#FB7185',
          'fitness-surface': '#FFF1F2',
          'fitness-surface-dark': '#4C0519',

          finance: '#65A30D',
          'finance-dark': '#A3E635',
          'finance-surface': '#F7FEE7',
          'finance-surface-dark': '#1A2E05',

          general: '#64748B',
          'general-dark': '#94A3B8',
          'general-surface': '#F1F5F9',
          'general-surface-dark': '#1E293B'
        },
        // Sync Status Indicators
        sync: {
          synced: '#0D9488',
          'synced-dark': '#2DD4BF',
          'synced-bg': '#F0FDFA',
          'synced-bg-dark': '#115E59',

          pending: '#D97706',
          'pending-dark': '#FBBF24',
          'pending-bg': '#FFFBEB',
          'pending-bg-dark': '#451A03',

          offline: '#64748B',
          'offline-dark': '#94A3B8',
          'offline-bg': '#F1F5F9',
          'offline-bg-dark': '#1E293B',

          error: '#E11D48',
          'error-dark': '#FB7185',
          'error-bg': '#FFF1F2',
          'error-bg-dark': '#4C0519'
        },
        // Neutral Surfaces & Texts
        canvas: 'var(--bg-canvas)',
        'surface-1': 'var(--surface-tier-1)',
        'surface-2': 'var(--surface-tier-2)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        'text-main': 'var(--text-main)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)'
      },
      borderRadius: {
        card: '1rem',      // 16px
        control: '0.75rem', // 12px
        checkbox: '0.5rem', // 8px
        full: '9999px'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      maxWidth: {
        workspace: '1040px'
      }
    }
  },
  plugins: []
};
