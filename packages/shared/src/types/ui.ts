import { LocaleDirection, SupportedLocale, ThemeMode } from '../enums/ui';

export interface LocaleConfig {
  locale: SupportedLocale;
  direction: LocaleDirection;
}

export interface ThemeConfig {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
}

export type StatusBadgeVariant = 'verified' | 'pending' | 'warning' | 'danger' | 'info' | 'neutral';
