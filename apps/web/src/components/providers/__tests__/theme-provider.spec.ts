/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import {
  ThemeProvider,
  useTheme,
  STORAGE_KEY_THEME,
} from '../theme-provider';

describe('ThemeProvider & useTheme', () => {
  let mockStorage: Record<string, string>;
  let mockDocumentElement: {
    classList: {
      add: (cls: string) => void;
      remove: (cls: string) => void;
      contains: (cls: string) => boolean;
      classes: Set<string>;
    };
  };

  beforeEach(() => {
    mockStorage = {};
    const classes = new Set<string>();

    mockDocumentElement = {
      classList: {
        classes,
        add(cls: string) {
          classes.add(cls);
        },
        remove(cls: string) {
          classes.delete(cls);
        },
        contains(cls: string) {
          return classes.has(cls);
        },
      },
    };

    (globalThis as any).window = {
      localStorage: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => {
          mockStorage[key] = val;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
      },
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    };

    (globalThis as any).document = {
      documentElement: mockDocumentElement,
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    vi.restoreAllMocks();
  });

  it('should render children during server side rendering', () => {
    const html = renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement('div', { id: 'theme-test' }, 'ثيم المصايف')
      )
    );
    expect(html).toContain('ثيم المصايف');
  });

  it('should export correct STORAGE_KEY_THEME', () => {
    expect(STORAGE_KEY_THEME).toBe('elmasaif_theme');
  });

  it('should throw an error when useTheme is invoked outside ThemeProvider', () => {
    function Consumer() {
      useTheme();
      return null;
    }
    expect(() => renderToString(React.createElement(Consumer))).toThrow(
      'useTheme must be used within a ThemeProvider'
    );
  });
});
