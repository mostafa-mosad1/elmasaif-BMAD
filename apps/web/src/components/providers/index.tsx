'use client';

import React from 'react';
import { DirectionProvider } from './direction-provider';
import { ThemeProvider } from './theme-provider';
import { AuthProvider } from './auth-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider>
      <ThemeProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </DirectionProvider>
  );
}

export * from './direction-provider';
export * from './theme-provider';
export * from './auth-provider';
