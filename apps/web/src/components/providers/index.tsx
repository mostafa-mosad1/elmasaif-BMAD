'use client';

import React from 'react';
import { DirectionProvider } from './direction-provider';
import { ThemeProvider } from './theme-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </DirectionProvider>
  );
}

export * from './direction-provider';
export * from './theme-provider';
