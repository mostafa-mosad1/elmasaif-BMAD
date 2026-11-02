import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import MarketerNewListingPage from '../new/page';
import OwnerNewListingPage from '../../../owner/listings/new/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('New Listing Pages (Marketer & Owner Routes) (AC: 4, 5)', () => {
  it('renders Marketer new listing page with breadcrumbs and wizard', () => {
    const html = renderToString(React.createElement(MarketerNewListingPage));

    expect(html).toContain('لوحة تحكم الوسيط');
    expect(html).toContain('العقارات المعروضة');
    expect(html).toContain('إضافة عقار جديد');
    expect(html).toContain('البيانات الأساسية للعقار');
  });

  it('renders Owner new listing page with breadcrumbs and wizard', () => {
    const html = renderToString(React.createElement(OwnerNewListingPage));

    expect(html).toContain('لوحة تحكم المالك');
    expect(html).toContain('عقاراتي');
    expect(html).toContain('إضافة عقار جديد');
    expect(html).toContain('البيانات الأساسية للعقار');
  });
});

