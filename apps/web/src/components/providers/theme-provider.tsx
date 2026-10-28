'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { ThemeMode, DEFAULT_THEME } from '@elmasaif/shared';

export const STORAGE_KEY_THEME = 'elmasaif_theme';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
      if (
        savedTheme === ThemeMode.LIGHT ||
        savedTheme === ThemeMode.DARK ||
        savedTheme === ThemeMode.SYSTEM
      ) {
        setThemeState(savedTheme as ThemeMode);
      }
    } catch {
      // Storage unavailable
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemDark(mediaQuery.matches);

      const listener = (event: MediaQueryListEvent) => {
        setSystemDark(event.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      }
    }

    setMounted(true);
  }, []);

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === ThemeMode.SYSTEM) {
      return systemDark ? 'dark' : 'light';
    }
    return theme === ThemeMode.DARK ? 'dark' : 'light';
  }, [theme, systemDark]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    if (resolvedTheme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY_THEME, theme);
      } catch {
        // Storage unavailable
      }
    }
  }, [resolvedTheme, theme, mounted]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const nextTheme = prev === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK;
      return nextTheme;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
