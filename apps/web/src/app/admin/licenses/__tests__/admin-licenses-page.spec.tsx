import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminLicensesPage from '../page';
import { formatLockCountdown } from '../licensing-helpers';
import { FalLicenseQueueItem, ProfileStatus } from '@elmasaif/shared';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const mockItems: FalLicenseQueueItem[] = [
  {
    id: 'fal-app-1',
    licenseNumber: '1200012345',
    commercialName: 'شركة الأفق العقارية',
    crNumber: '1010123456',
    expiryDate: '2028-10-15T00:00:00.000Z',
    status: ProfileStatus.UNDER_REVIEW,
    createdAt: '2026-11-09T10:00:00.000Z',
    updatedAt: '2026-11-09T10:00:00.000Z',
    applicantName: 'محمد السالم',
    applicantPhone: '0501234567',
    applicantNationalId: '1012345678',
    lockInfo: {
      isLocked: false,
      isLockedByCurrentAdmin: false,
      lockedByAdminId: null,
      lockedByAdminName: null,
      lockedAt: null,
      lockExpiresAt: null,
      remainingSeconds: 0,
    },
  },
  {
    id: 'fal-app-2',
    licenseNumber: '1200098765',
    commercialName: 'مكتب الرياض المتقدم',
    crNumber: '1010654321',
    expiryDate: '2029-01-01T00:00:00.000Z',
    status: ProfileStatus.UNDER_REVIEW,
    createdAt: '2026-11-09T11:00:00.000Z',
    updatedAt: '2026-11-09T11:00:00.000Z',
    applicantName: 'عبدالله الشمري',
    applicantPhone: '0559876543',
    applicantNationalId: '1087654321',
    lockInfo: {
      isLocked: true,
      isLockedByCurrentAdmin: false,
      lockedByAdminId: 'admin-other',
      lockedByAdminName: 'سارة المشرفة',
      lockedAt: '2026-11-09T11:05:00.000Z',
      lockExpiresAt: '2026-11-09T11:20:00.000Z',
      remainingSeconds: 540,
    },
  },
];

describe('AdminLicensesPage', () => {
  it('formats lock countdown MM:SS correctly', () => {
    expect(formatLockCountdown(900)).toBe('15:00');
    expect(formatLockCountdown(540)).toBe('09:00');
    expect(formatLockCountdown(65)).toBe('01:05');
    expect(formatLockCountdown(0)).toBe('00:00');
    expect(formatLockCountdown(-10)).toBe('00:00');
  });

  it('renders header, tabs, and queue table with mock items', () => {
    const html = renderToString(
      <AdminLicensesPage initialItems={mockItems} initialTotal={2} initialLoading={false} />,
    );

    expect(html).toContain('طابور تدقيق واعتماد رخص فال (REGA)');
    expect(html).toContain('قيد المراجعة');
    expect(html).toContain('المعتمدة');
    expect(html).toContain('المرفوضة');
    expect(html).toContain('الكل');

    // Item 1
    expect(html).toContain('1200012345');
    expect(html).toContain('شركة الأفق العقارية');
    expect(html).toContain('محمد السالم');
    expect(html).toContain('متاح للمراجعة');

    // Item 2
    expect(html).toContain('1200098765');
    expect(html).toContain('مكتب الرياض المتقدم');
    expect(html).toContain('سارة المشرفة');
    expect(html).toContain('09:00');
  });
});

