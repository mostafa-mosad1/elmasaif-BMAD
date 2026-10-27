import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B4332',
          hover: '#143326',
          light: '#E8F3EE',
          dark: '#2D6A4F',
          darkHover: '#3D8565',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#C69C45',
          hover: '#B38A38',
          light: '#FAF4E8',
          dark: '#D4AF37',
          foreground: '#1A1208',
        },
        surface: {
          background: '#F8FAF9',
          base: '#FFFFFF',
          sunken: '#F0F4F2',
          border: '#E2E8F0',
          borderStrong: '#CBD5E1',
        },
        ink: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#94A3B8',
          disabled: '#CBD5E1',
          inverse: '#FFFFFF',
        },
        status: {
          verified: '#059669',
          verifiedBg: '#ECFDF5',
          pending: '#D97706',
          pendingBg: '#FFFBEB',
          danger: '#DC2626',
          dangerBg: '#FEF2F2',
          info: '#2563EB',
          infoBg: '#EFF6FF',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '10px',
        card: '16px',
        pill: '9999px',
      }
    },
  },
  plugins: [],
};

export default config;
