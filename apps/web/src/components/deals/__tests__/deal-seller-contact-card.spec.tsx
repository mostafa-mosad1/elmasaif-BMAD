import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  DEAL_NOTARY_GUIDANCE_AR,
  DEAL_SELLER_CONTACT_TITLE_AR,
  DealSellerContactCard,
} from '../deal-seller-contact-card';

describe('DealSellerContactCard (Story 5.4 / AC: 3, 6)', () => {
  const sellerContact = {
    fullName: 'سارة إبراهيم القحطاني',
    mobileNumber: '+966559876543',
    email: 'sara@example.sa',
  };

  it('renders verified seller contact details with clickable tel and mailto links', () => {
    const html = renderToString(
      React.createElement(DealSellerContactCard, { sellerContact }),
    );

    expect(html).toContain(DEAL_SELLER_CONTACT_TITLE_AR);
    expect(html).toContain('سارة إبراهيم القحطاني');
    expect(html).toContain('+966559876543');
    expect(html).toContain('href="tel:+966559876543"');
    expect(html).toContain('sara@example.sa');
    expect(html).toContain('href="mailto:sara@example.sa"');
    expect(html).toContain(DEAL_NOTARY_GUIDANCE_AR);
    expect(html).toContain('هوية موثقة');
  });

  it('renders nothing when sellerContact is null/undefined (concealment invariant)', () => {
    const html = renderToString(
      React.createElement(DealSellerContactCard, { sellerContact: null }),
    );
    expect(html).toBe('');
  });
});

