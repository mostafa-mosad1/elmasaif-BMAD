import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ClaimLockInfo } from '@elmasaif/shared';
import { TaskClaimLockBanner } from '../task-claim-lock-banner';
import {
  formatLockCountdown,
  buildIfMatchHeaders,
} from '../../../hooks/use-task-claim-lock';

describe('TaskClaimLockBanner & useTaskClaimLock utilities (Story 8.3) (AC: 4, 5, 6)', () => {
  it('formats lock countdown in MM:SS and builds If-Match headers for optimistic concurrency', () => {
    expect(formatLockCountdown(900)).toBe('15:00');
    expect(formatLockCountdown(299)).toBe('04:59');
    expect(formatLockCountdown(0)).toBe('00:00');
    expect(formatLockCountdown(-15)).toBe('00:00');

    expect(buildIfMatchHeaders(3)).toEqual({ 'If-Match': '"3"' });
    expect(buildIfMatchHeaders(1)).toEqual({ 'If-Match': '"1"' });
    expect(buildIfMatchHeaders(null)).toEqual({});
    expect(buildIfMatchHeaders(undefined)).toEqual({});
    expect(buildIfMatchHeaders(0)).toEqual({});
  });

  it('renders prominent amber read-only warning banner when locked by another admin', () => {
    const lockedByOther: ClaimLockInfo = {
      isLocked: true,
      lockedByAdminId: 'admin-other-99',
      lockedByAdminName: 'خالد السبيعي',
      lockedAt: '2026-11-12T10:00:00.000Z',
      lockExpiresAt: '2026-11-12T10:15:00.000Z',
      remainingSeconds: 615,
      isLockedByCurrentAdmin: false,
    };

    const html = renderToString(
      <TaskClaimLockBanner
        lockInfo={lockedByOther}
        version={4}
        queueLabelAr="مراجعة الإعلانات العقارية"
        canForceUnlock={false}
      />,
    );

    expect(html).toContain('data-lock-state="LOCKED_BY_OTHER"');
    expect(html).toContain('bg-amber-50');
    expect(html).toContain('هذه المهمة قيد المراجعة حالياً من قِبل: خالد السبيعي');
    expect(html).toContain('10:15');
    expect(html).toContain('v4');
    expect(html).toContain('وضع القراءة فقط — جميع أزرار القرار معطلة لمنع التعارض');
    expect(html).not.toContain('فك القفل قسرياً (Super Admin)');
  });

  it('renders Super Admin Force-Unlock CTA and audit reason modal when canForceUnlock is true', () => {
    const lockedByOther: ClaimLockInfo = {
      isLocked: true,
      lockedByAdminId: 'admin-other-99',
      lockedByAdminName: 'خالد السبيعي',
      lockedAt: '2026-11-12T10:00:00.000Z',
      lockExpiresAt: '2026-11-12T10:15:00.000Z',
      remainingSeconds: 480,
      isLockedByCurrentAdmin: false,
    };

    const html = renderToString(
      <TaskClaimLockBanner
        lockInfo={lockedByOther}
        version={2}
        queueLabelAr="الفصل في النزاعات"
        canForceUnlock={true}
        defaultForceUnlockOpen={true}
      />,
    );

    expect(html).toContain('فك القفل قسرياً (Super Admin)');
    expect(html).toContain('data-testid="force-unlock-modal"');
    expect(html).toContain('الصلاحية: Tasks.ForceUnlock');
    expect(html).toContain('سبب فك القفل القسري (إلزامي - 5 أحرف على الأقل)');
    expect(html).toContain('تأكيد فك القفل وتوثيق السبب');
  });

  it('renders active emerald lease countdown and 5-minute auto-heartbeat indicator when locked by current admin', () => {
    const lockedByMe: ClaimLockInfo = {
      isLocked: true,
      lockedByAdminId: 'admin-me-1',
      lockedByAdminName: 'سلطان القحطاني',
      lockedAt: '2026-11-12T10:00:00.000Z',
      lockExpiresAt: '2026-11-12T10:15:00.000Z',
      remainingSeconds: 900,
      isLockedByCurrentAdmin: true,
    };

    const html = renderToString(
      <TaskClaimLockBanner
        lockInfo={lockedByMe}
        version={7}
        onHeartbeat={() => {}}
        onRelease={() => {}}
      />,
    );

    expect(html).toContain('data-lock-state="LOCKED_BY_ME"');
    expect(html).toContain('bg-emerald-50');
    expect(html).toContain('المهمة محجوزة باسمك للمراجعة الحصرية');
    expect(html).toContain('15:00');
    expect(html).toContain('تجديد تلقائي كل 5 دقائق');
    expect(html).toContain('If-Match: &quot;7&quot;');
    expect(html).toContain('تجديد القفل الآن');
    expect(html).toContain('تحرير المهمة');
  });

  it('renders claim task call-to-action when task is unlocked', () => {
    const unlocked: ClaimLockInfo = {
      isLocked: false,
      lockedByAdminId: null,
      lockedByAdminName: null,
      lockedAt: null,
      lockExpiresAt: null,
      remainingSeconds: 0,
      isLockedByCurrentAdmin: false,
    };

    const html = renderToString(
      <TaskClaimLockBanner lockInfo={unlocked} version={1} onClaim={() => {}} />,
    );

    expect(html).toContain('data-lock-state="UNLOCKED"');
    expect(html).toContain('المهمة متاحة للاستلام والمراجعة');
    expect(html).toContain('استلام المهمة وبدء المراجعة (حجز 15 دقيقة)');
  });
});

