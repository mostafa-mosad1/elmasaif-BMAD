'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  LocaleDirection,
  SupportedLocale,
  DEFAULT_LOCALE,
} from '@elmasaif/shared';

export const STORAGE_KEY_LOCALE = 'elmasaif_locale';

interface DirectionContextType {
  locale: SupportedLocale;
  direction: LocaleDirection;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
}

const DirectionContext = createContext<DirectionContextType | undefined>(undefined);

export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  const direction = useMemo(() => {
    return locale === SupportedLocale.EN ? LocaleDirection.LTR : LocaleDirection.RTL;
  }, [locale]);

  useEffect(() => {
    try {
      const savedLocale = localStorage.getItem(STORAGE_KEY_LOCALE);
      if (savedLocale === SupportedLocale.EN || savedLocale === SupportedLocale.AR) {
        setLocaleState(savedLocale as SupportedLocale);
      }
    } catch {
      // Storage unavailable or disabled
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    html.setAttribute('dir', direction);
    html.setAttribute('lang', locale);

    if (document.body) {
      if (locale === SupportedLocale.EN) {
        document.body.classList.remove('font-sans');
        document.body.classList.add('font-secondary');
      } else {
        document.body.classList.remove('font-secondary');
        document.body.classList.add('font-sans');
      }
    }

    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY_LOCALE, locale);
      } catch {
        // Storage unavailable
      }
    }
  }, [locale, direction, mounted]);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
  };

  const toggleLocale = () => {
    setLocaleState((prev) =>
      prev === SupportedLocale.AR ? SupportedLocale.EN : SupportedLocale.AR
    );
  };

  const contextValue = useMemo(
    () => ({
      locale,
      direction,
      setLocale,
      toggleLocale,
    }),
    [locale, direction]
  );

  return (
    <DirectionContext.Provider value={contextValue}>
      {children}
    </DirectionContext.Provider>
  );
}

export function useDirection(): DirectionContextType {
  const context = useContext(DirectionContext);
  if (!context) {
    throw new Error('useDirection must be used within a DirectionProvider');
  }
  return context;
}
