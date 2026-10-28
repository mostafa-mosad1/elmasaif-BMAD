import { LocaleDirection, SupportedLocale, ThemeMode } from '../enums/ui';

export const DEFAULT_LOCALE = SupportedLocale.AR;
export const DEFAULT_DIRECTION = LocaleDirection.RTL;
export const DEFAULT_THEME = ThemeMode.LIGHT;

export const SOVEREIGN_COLORS = {
  primary: {
    DEFAULT: '#1B4332',
    hover: '#143326',
    light: '#E8F3EE',
    foreground: '#FFFFFF',
    dark: '#2D6A4F',
    darkHover: '#3D8565'
  },
  accent: {
    DEFAULT: '#C69C45',
    hover: '#B38A38',
    light: '#FAF4E8',
    foreground: '#1A1208',
    dark: '#D4AF37'
  },
  surface: {
    background: '#F8FAF9',
    base: '#FFFFFF',
    raised: '#FFFFFF',
    sunken: '#F0F4F2',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1'
  },
  ink: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    disabled: '#CBD5E1',
    inverse: '#FFFFFF'
  },
  darkSurface: {
    background: '#0B130E',
    base: '#132018',
    raised: '#1C2E24',
    sunken: '#0E1712',
    border: '#23382C',
    borderStrong: '#32503E'
  },
  darkInk: {
    primary: '#F1F5F9',
    secondary: '#CBD5E1',
    muted: '#64748B',
    disabled: '#334155',
    inverse: '#0F172A'
  },
  status: {
    verified: {
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0'
    },
    pending: {
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A'
    },
    danger: {
      color: '#DC2626',
      bg: '#FEF2F2',
      border: '#FECACA'
    },
    info: {
      color: '#2563EB',
      bg: '#EFF6FF',
      border: '#BFDBFE'
    },
    neutral: {
      color: '#64748B',
      bg: '#F1F5F9',
      border: '#E2E8F0'
    }
  },
  dualWire: {
    platformFee: {
      color: '#1B4332',
      bg: '#F0F7F4'
    },
    sellerPrice: {
      color: '#0F172A',
      bg: '#F8FAFC'
    }
  }
} as const;

export const BRAND_COLORS = {
  primary: '#1B4332',
  accent: '#C69C45',
  primaryHover: '#143326',
  accentHover: '#B38A38'
} as const;

export const STATUS_COLORS = {
  verified: '#059669',
  pending: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  neutral: '#64748B'
} as const;

export const TYPOGRAPHY_CONFIG = {
  fontPrimary: 'IBM Plex Sans Arabic',
  fontMono: 'JetBrains Mono',
  fontSecondary: 'Inter'
} as const;
