import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { Modal } from '../modal';

/**
 * Modal is a client overlay, so the house convention applies: assert the SSR markup only
 * (no jsdom interaction tests).
 */
describe('Modal', () => {
  it('renders nothing while closed', () => {
    const html = renderToString(
      <Modal open={false} onClose={() => {}} ariaLabel="نموذج تجريبي">
        <p>محتوى</p>
      </Modal>,
    );
    expect(html).toBe('');
  });

  it('renders an accessible dialog shell with the close affordance and children', () => {
    const html = renderToString(
      <Modal open onClose={() => {}} ariaLabel="نموذج تقديم عرض الشراء" testId="offer-modal">
        <p>محتوى النموذج</p>
      </Modal>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="نموذج تقديم عرض الشراء"');
    expect(html).toContain('data-testid="offer-modal"');
    expect(html).toContain('محتوى النموذج');
    // Default Arabic close label, also used as the button accessible name.
    expect(html).toContain('إغلاق');
    expect(html).toContain('aria-label="إغلاق"');
  });

  it('honours a custom close test id and panel width', () => {
    const html = renderToString(
      <Modal
        open
        onClose={() => {}}
        ariaLabel="نموذج"
        closeTestId="modal-close-x"
        panelClassName="max-w-3xl"
      >
        <span />
      </Modal>,
    );
    expect(html).toContain('data-testid="modal-close-x"');
    expect(html).toContain('max-w-3xl');
  });
});
