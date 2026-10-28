import { describe, it, expect } from 'vitest';
import {
  LocaleDirection,
  SupportedLocale,
  ThemeMode,
  SOVEREIGN_COLORS,
  BRAND_COLORS,
  STATUS_COLORS,
  TYPOGRAPHY_CONFIG,
  DEFAULT_LOCALE,
  DEFAULT_DIRECTION,
  DEFAULT_THEME,
} from '../../index';

describe('Shared UI Enums, Constants & Design Tokens', () => {
  describe('Locale & Direction Enums', () => {
    it('should export correct LocaleDirection values', () => {
      expect(LocaleDirection.RTL).toBe('rtl');
      expect(LocaleDirection.LTR).toBe('ltr');
    });

    it('should export correct SupportedLocale values', () => {
      expect(SupportedLocale.AR).toBe('ar');
      expect(SupportedLocale.EN).toBe('en');
    });

    it('should export correct ThemeMode values', () => {
      expect(ThemeMode.LIGHT).toBe('light');
      expect(ThemeMode.DARK).toBe('dark');
      expect(ThemeMode.SYSTEM).toBe('system');
    });

    it('should have correct default locale, direction, and theme', () => {
      expect(DEFAULT_LOCALE).toBe(SupportedLocale.AR);
      expect(DEFAULT_DIRECTION).toBe(LocaleDirection.RTL);
      expect(DEFAULT_THEME).toBe(ThemeMode.LIGHT);
    });
  });

  describe('Sovereign Design Colors (DESIGN.md Compliance)', () => {
    it('should match exact Sovereign Emerald primary ramp', () => {
      expect(SOVEREIGN_COLORS.primary.DEFAULT).toBe('#1B4332');
      expect(SOVEREIGN_COLORS.primary.hover).toBe('#143326');
      expect(SOVEREIGN_COLORS.primary.light).toBe('#E8F3EE');
      expect(SOVEREIGN_COLORS.primary.foreground).toBe('#FFFFFF');
      expect(SOVEREIGN_COLORS.primary.dark).toBe('#2D6A4F');
      expect(SOVEREIGN_COLORS.primary.darkHover).toBe('#3D8565');
    });

    it('should match exact Desert Gold financial accent ramp', () => {
      expect(SOVEREIGN_COLORS.accent.DEFAULT).toBe('#C69C45');
      expect(SOVEREIGN_COLORS.accent.hover).toBe('#B38A38');
      expect(SOVEREIGN_COLORS.accent.light).toBe('#FAF4E8');
      expect(SOVEREIGN_COLORS.accent.foreground).toBe('#1A1208');
      expect(SOVEREIGN_COLORS.accent.dark).toBe('#D4AF37');
    });

    it('should match light mode surface and ink scale', () => {
      expect(SOVEREIGN_COLORS.surface.background).toBe('#F8FAF9');
      expect(SOVEREIGN_COLORS.surface.base).toBe('#FFFFFF');
      expect(SOVEREIGN_COLORS.surface.sunken).toBe('#F0F4F2');
      expect(SOVEREIGN_COLORS.surface.border).toBe('#E2E8F0');
      expect(SOVEREIGN_COLORS.surface.borderStrong).toBe('#CBD5E1');

      expect(SOVEREIGN_COLORS.ink.primary).toBe('#0F172A');
      expect(SOVEREIGN_COLORS.ink.secondary).toBe('#475569');
      expect(SOVEREIGN_COLORS.ink.muted).toBe('#94A3B8');
      expect(SOVEREIGN_COLORS.ink.disabled).toBe('#CBD5E1');
      expect(SOVEREIGN_COLORS.ink.inverse).toBe('#FFFFFF');
    });

    it('should match dark mode surface and ink scale', () => {
      expect(SOVEREIGN_COLORS.darkSurface.background).toBe('#0B130E');
      expect(SOVEREIGN_COLORS.darkSurface.base).toBe('#132018');
      expect(SOVEREIGN_COLORS.darkSurface.raised).toBe('#1C2E24');
      expect(SOVEREIGN_COLORS.darkSurface.sunken).toBe('#0E1712');
      expect(SOVEREIGN_COLORS.darkSurface.border).toBe('#23382C');
      expect(SOVEREIGN_COLORS.darkSurface.borderStrong).toBe('#32503E');

      expect(SOVEREIGN_COLORS.darkInk.primary).toBe('#F1F5F9');
      expect(SOVEREIGN_COLORS.darkInk.secondary).toBe('#CBD5E1');
      expect(SOVEREIGN_COLORS.darkInk.muted).toBe('#64748B');
      expect(SOVEREIGN_COLORS.darkInk.disabled).toBe('#334155');
      expect(SOVEREIGN_COLORS.darkInk.inverse).toBe('#0F172A');
    });

    it('should match status badge tokens', () => {
      expect(SOVEREIGN_COLORS.status.verified.color).toBe('#059669');
      expect(SOVEREIGN_COLORS.status.verified.bg).toBe('#ECFDF5');
      expect(SOVEREIGN_COLORS.status.verified.border).toBe('#A7F3D0');

      expect(SOVEREIGN_COLORS.status.pending.color).toBe('#D97706');
      expect(SOVEREIGN_COLORS.status.pending.bg).toBe('#FFFBEB');
      expect(SOVEREIGN_COLORS.status.pending.border).toBe('#FDE68A');

      expect(SOVEREIGN_COLORS.status.danger.color).toBe('#DC2626');
      expect(SOVEREIGN_COLORS.status.danger.bg).toBe('#FEF2F2');
      expect(SOVEREIGN_COLORS.status.danger.border).toBe('#FECACA');

      expect(SOVEREIGN_COLORS.status.info.color).toBe('#2563EB');
      expect(SOVEREIGN_COLORS.status.info.bg).toBe('#EFF6FF');
      expect(SOVEREIGN_COLORS.status.info.border).toBe('#BFDBFE');

      expect(SOVEREIGN_COLORS.status.neutral.color).toBe('#64748B');
      expect(SOVEREIGN_COLORS.status.neutral.bg).toBe('#F1F5F9');
      expect(SOVEREIGN_COLORS.status.neutral.border).toBe('#E2E8F0');
    });

    it('should match dual wire transfer segregated colors', () => {
      expect(SOVEREIGN_COLORS.dualWire.platformFee.color).toBe('#1B4332');
      expect(SOVEREIGN_COLORS.dualWire.platformFee.bg).toBe('#F0F7F4');

      expect(SOVEREIGN_COLORS.dualWire.sellerPrice.color).toBe('#0F172A');
      expect(SOVEREIGN_COLORS.dualWire.sellerPrice.bg).toBe('#F8FAFC');
    });
  });

  describe('BRAND_COLORS, STATUS_COLORS & TYPOGRAPHY_CONFIG (AC 7)', () => {
    it('should export BRAND_COLORS with primary and accent', () => {
      expect(BRAND_COLORS.primary).toBe('#1B4332');
      expect(BRAND_COLORS.accent).toBe('#C69C45');
    });

    it('should export STATUS_COLORS matching domain status variants', () => {
      expect(STATUS_COLORS.verified).toBe('#059669');
      expect(STATUS_COLORS.pending).toBe('#D97706');
      expect(STATUS_COLORS.danger).toBe('#DC2626');
      expect(STATUS_COLORS.info).toBe('#2563EB');
      expect(STATUS_COLORS.neutral).toBe('#64748B');
    });

    it('should export TYPOGRAPHY_CONFIG matching DESIGN.md font stacks', () => {
      expect(TYPOGRAPHY_CONFIG.fontPrimary).toBe('IBM Plex Sans Arabic');
      expect(TYPOGRAPHY_CONFIG.fontMono).toBe('JetBrains Mono');
      expect(TYPOGRAPHY_CONFIG.fontSecondary).toBe('Inter');
    });
  });
});
