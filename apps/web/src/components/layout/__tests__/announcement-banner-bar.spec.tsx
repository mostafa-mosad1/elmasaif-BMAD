import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AnnouncementBannerBar } from '../announcement-banner-bar';

describe('AnnouncementBannerBar SSR (Story 8.9 / AC5)', () => {
  it('renders nothing on initial SSR when no active banners are loaded yet', () => {
    const html = renderToString(<AnnouncementBannerBar />);
    expect(html).toBe('');
  });
});

