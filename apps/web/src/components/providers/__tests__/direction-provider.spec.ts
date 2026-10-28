/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import {
  DirectionProvider,
  useDirection,
  STORAGE_KEY_LOCALE,
} from '../direction-provider';

describe('DirectionProvider & useDirection', () => {
  let mockStorage: Record<string, string>;
  let mockDocumentElement: {
    attributes: Record<string, string>;
    setAttribute: (name: string, value: string) => void;
    getAttribute: (name: string) => string | null;
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
      attributes: {},
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
      getAttribute(name: string) {
        return this.attributes[name] || null;
      },
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
    };

    (globalThis as any).document = {
      documentElement: mockDocumentElement,
      body: {
        classList: mockDocumentElement.classList,
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    vi.restoreAllMocks();
  });

  it('should render children correctly during server rendering', () => {
    const html = renderToString(
      React.createElement(
        DirectionProvider,
        null,
        React.createElement('div', { id: 'test-child' }, 'محتوى الاختبار')
      )
    );
    expect(html).toContain('محتوى الاختبار');
  });

  it('should export correct STORAGE_KEY_LOCALE', () => {
    expect(STORAGE_KEY_LOCALE).toBe('elmasaif_locale');
  });

  it('should throw an error when useDirection is invoked outside DirectionProvider', () => {
    function Consumer() {
      useDirection();
      return null;
    }
    expect(() => renderToString(React.createElement(Consumer))).toThrow(
      'useDirection must be used within a DirectionProvider'
    );
  });
});
