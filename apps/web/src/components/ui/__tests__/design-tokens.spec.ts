/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import config from '../../../../tailwind.config';

describe('Tailwind Design Tokens Configuration (DESIGN.md Compliance)', () => {
  const theme = config.theme?.extend;

  it('should enable class-based dark mode', () => {
    expect(config.darkMode).toBe('class');
  });

  it('should extend fonts with Arabic primary, monospace numerals, and Latin secondary', () => {
    expect(theme?.fontFamily?.sans).toBeDefined();
    expect(theme?.fontFamily?.sans[0]).toBe('IBM Plex Sans Arabic');
    expect(theme?.fontFamily?.mono).toBeDefined();
    expect(theme?.fontFamily?.mono[0]).toBe('JetBrains Mono');
    expect(theme?.fontFamily?.secondary).toBeDefined();
    expect(theme?.fontFamily?.secondary).toContain('Inter');
  });

  it('should extend colors with Sovereign Emerald and Desert Gold palettes', () => {
    const colors = theme?.colors as Record<string, any>;
    expect(colors.primary.DEFAULT).toBe('#0F172A');
    expect(colors.primary.hover).toBe('#1E293B');
    expect(colors.primary.light).toBe('#F5F5F4');
    expect(colors.primary.foreground).toBe('#FFFFFF');
    expect(colors.primary.dark).toBe('#1E293B');

    expect(colors.accent.DEFAULT).toBe('#D97706');
    expect(colors.accent.hover).toBe('#B45309');
    expect(colors.accent.light).toBe('#FEF3C7');
    expect(colors.accent.foreground).toBe('#1C1917');
  });

  it('should define dark mode surfaces and ink scales', () => {
    const colors = theme?.colors as Record<string, any>;
    expect(colors['dark-background']).toBe('#07090C');
    expect(colors['dark-surface-base']).toBe('#0F1318');
    expect(colors['dark-surface-raised']).toBe('#161C24');
    expect(colors['dark-surface-sunken']).toBe('#040608');
    expect(colors['dark-surface-border']).toBe('#1E2633');
    expect(colors['dark-surface-border-strong']).toBe('#2B374A');

    expect(colors['dark-ink-primary']).toBe('#F8FAFC');
    expect(colors['dark-ink-secondary']).toBe('#94A3B8');
    expect(colors['dark-ink-muted']).toBe('#64748B');
    expect(colors['dark-ink-disabled']).toBe('#334155');
  });

  it('should define status badge tokens and dual wire transfer segregation', () => {
    const colors = theme?.colors as Record<string, any>;
    expect(colors.status.verified).toBe('#D97706');
    expect(colors.status.pending).toBe('#D97706');
    expect(colors.status.danger).toBe('#DC2626');
    expect(colors.status.info).toBe('#2563EB');
    expect(colors.status.neutral).toBe('#64748B');

    expect(colors['deal-platform-fee']).toBe('#0F172A');
    expect(colors['deal-seller-price']).toBe('#D97706');
  });

  it('should define radii matching DESIGN.md scale', () => {
    const radius = theme?.borderRadius as Record<string, any>;
    expect(radius.xs).toBe('4px');
    expect(radius.sm).toBe('6px');
    expect(radius.DEFAULT).toBe('10px');
    expect(radius.card).toBe('16px');
    expect(radius.xl).toBe('24px');
    expect(radius.pill).toBe('9999px');
  });

  it('should define layout spacing tokens for container and sidebars', () => {
    const spacing = theme?.spacing as Record<string, any>;
    expect(spacing.containerMax).toBe('1280px');
    expect(spacing.sidebar).toBe('280px');
    expect(spacing.adminSidebar).toBe('260px');
  });
});
