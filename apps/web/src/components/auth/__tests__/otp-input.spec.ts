import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OtpInput } from '../otp-input';

describe('OtpInput Component (AC: 6)', () => {
  it('renders 6 input slots with monospace font and LTR direction', () => {
    const html = renderToString(
      React.createElement(OtpInput, {
        value: '123',
        onChange: () => {},
        autoFocus: false
      })
    );

    expect(html).toContain('dir="ltr"');
    expect(html).toContain('font-mono');
    // Count digit inputs
    const inputMatches = html.match(/<input/g);
    expect(inputMatches).toHaveLength(6);
  });

  it('renders prefilled values in the corresponding boxes', () => {
    const html = renderToString(
      React.createElement(OtpInput, {
        value: '456789',
        onChange: () => {},
        autoFocus: false
      })
    );

    expect(html).toContain('value="4"');
    expect(html).toContain('value="5"');
    expect(html).toContain('value="6"');
    expect(html).toContain('value="7"');
    expect(html).toContain('value="8"');
    expect(html).toContain('value="9"');
  });

  it('applies error styling when hasError is true', () => {
    const html = renderToString(
      React.createElement(OtpInput, {
        value: '',
        onChange: () => {},
        hasError: true,
        autoFocus: false
      })
    );

    expect(html).toContain('border-status-danger');
    expect(html).toContain('text-status-danger');
  });

  it('applies disabled attributes when disabled is true', () => {
    const html = renderToString(
      React.createElement(OtpInput, {
        value: '',
        onChange: () => {},
        disabled: true,
        autoFocus: false
      })
    );

    expect(html).toContain('disabled');
    expect(html).toContain('cursor-not-allowed');
  });
});

