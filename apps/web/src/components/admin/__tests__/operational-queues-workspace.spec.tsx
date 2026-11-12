import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  OPERATIONAL_QUEUE_METADATA,
  OPERATIONAL_QUEUE_TYPES,
  OperationalQueuesHubResponse,
} from '@elmasaif/shared';
import { OperationalQueuesWorkspace } from '../operational-queues-workspace';

const mockHubData: OperationalQueuesHubResponse = {
  serverTimestamp: '2026-11-12T10:30:00.000Z',
  leaseDurationSeconds: 900,
  heartbeatIntervalSeconds: 300,
  counts: OPERATIONAL_QUEUE_TYPES.map((queue, idx) => ({
    queue,
    totalOpen: idx + 2,
    unlocked: 1,
    lockedByMe: idx % 2 === 0 ? 1 : 0,
    lockedByOther: idx % 2 === 1 ? 1 : 0,
  })),
  items: [
    {
      id: 'listing-task-1',
      queue: 'LISTING',
      queueSlug: 'listings',
      referenceCode: 'ELM-2026-00101',
      titleAr: 'قصر فاخر في الهدا — الطائف',
      status: 'PENDING_REVIEW',
      version: 3,
      createdAt: '2026-11-12T09:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
      workspaceHref: '/admin/listings/moderation',
      lockInfo: {
        isLocked: true,
        lockedByAdminId: 'admin-other-2',
        lockedByAdminName: 'فهد الدوسري',
        lockedAt: '2026-11-12T10:20:00.000Z',
        lockExpiresAt: '2026-11-12T10:35:00.000Z',
        remainingSeconds: 600,
        isLockedByCurrentAdmin: false,
      },
    },
    {
      id: 'dispute-task-2',
      queue: 'DISPUTE',
      queueSlug: 'disputes',
      referenceCode: 'DSP-2026-00044',
      titleAr: 'نزاع عربون صفقة شاليه الشفا',
      status: 'UNDER_REVIEW',
      version: 5,
      createdAt: '2026-11-12T08:00:00.000Z',
      updatedAt: '2026-11-12T10:10:00.000Z',
      workspaceHref: '/admin/disputes',
      lockInfo: {
        isLocked: true,
        lockedByAdminId: 'admin-me-1',
        lockedByAdminName: 'عبدالله السديري',
        lockedAt: '2026-11-12T10:25:00.000Z',
        lockExpiresAt: '2026-11-12T10:40:00.000Z',
        remainingSeconds: 900,
        isLockedByCurrentAdmin: true,
      },
    },
    {
      id: 'payment-task-3',
      queue: 'PAYMENT',
      queueSlug: 'payments',
      referenceCode: 'PAY-2026-00912',
      titleAr: 'مراجعة حوالة بنكية — فيلا أبها',
      status: 'UNDER_REVIEW',
      version: 1,
      createdAt: '2026-11-12T09:30:00.000Z',
      updatedAt: '2026-11-12T09:30:00.000Z',
      workspaceHref: '/admin/payments',
      lockInfo: {
        isLocked: false,
        lockedByAdminId: null,
        lockedByAdminName: null,
        lockedAt: null,
        lockExpiresAt: null,
        remainingSeconds: 0,
        isLockedByCurrentAdmin: false,
      },
    },
  ],
};

describe('OperationalQueuesWorkspace Unified Hub (Story 8.3) (AC: 3, 5, 6)', () => {
  it('renders summary cards for all 8 operational queues with Arabic titles and RBAC permissions', () => {
    const html = renderToString(
      <OperationalQueuesWorkspace
        initialHubData={mockHubData}
        canForceUnlock={true}
      />,
    );

    expect(html).toContain('طوابير المهام والأقفال التشغيلية الموحدة (8 طوابير)');
    for (const queueType of OPERATIONAL_QUEUE_TYPES) {
      const meta = OPERATIONAL_QUEUE_METADATA[queueType];
      expect(html).toContain(meta.labelAr);
      expect(html).toContain(meta.reviewPermission);
      expect(html).toContain(`data-testid="queue-card-${meta.slug}"`);
    }
  });

  it('renders task rows with locked-by-other amber badge, locked-by-me emerald badge, unlocked state, and Super Admin force-unlock action', () => {
    const html = renderToString(
      <OperationalQueuesWorkspace
        initialHubData={mockHubData}
        initialSelectedItemId="listing-task-1"
        canForceUnlock={true}
      />,
    );

    expect(html).toContain('ELM-2026-00101');
    expect(html).toContain('قصر فاخر في الهدا — الطائف');
    expect(html).toContain('محجوزة بواسطة: فهد الدوسري (وضع القراءة فقط)');
    expect(html).toContain('10:00');
    expect(html).toContain('فك القفل قسرياً');

    expect(html).toContain('DSP-2026-00044');
    expect(html).toContain('محجوزة باسمك');
    expect(html).toContain('15:00');
    expect(html).toContain('تجديد القفل');
    expect(html).toContain('تحرير المهمة');

    expect(html).toContain('PAY-2026-00912');
    expect(html).toContain('متاحة للاستلام (غير محجوزة)');
    expect(html).toContain('استلام المهمة');
  });
});

