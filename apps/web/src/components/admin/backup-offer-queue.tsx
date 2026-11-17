'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BACKUP_QUEUE_STATE_LABELS_AR,
  BackupOfferQueueGroup,
  BackupOfferQueueItem,
  OfferLockInfo,
  PROPERTY_TYPE_LABELS_AR,
} from '@elmasaif/shared';
import { AlertCircle, ArrowRight, Clock, HandCoins, Lock, RefreshCw, Unlock } from 'lucide-react';
import { apiClient, describeApiError, readLockHolderName } from '../../lib/api-client';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from '../ui';
import { formatSar } from '../listings/commission-calculator';
import { formatOfferExpiry } from '../offers/buyer-offers-list';

interface BackupQueuePayload {
  data?: {
    items?: BackupOfferQueueGroup[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
  };
}

/**
 * Story 4.3 / AC#4: the activation refusals are explicit codes — never a generic failure. The
 * mapping lives here so a second administrator reads the same institutional copy the API wrote.
 */
const BACKUP_ERROR_MESSAGES_AR: Record<string, string> = {
  OFFER_BACKUP_NOT_QUEUED: 'هذا العرض ليس عرضاً احتياطياً معتمداً في طابور الانتظار',
  OFFER_BACKUP_ALREADY_ACTIVATED: 'سبق تفعيل عرض احتياطي على هذا العقار',
  OFFER_BACKUP_PRIMARY_DEAL_ACTIVE: 'لا يمكن تفعيل العرض الاحتياطي قبل إقفال الصفقة الأساسية',
  OFFER_BACKUP_LISTING_UNAVAILABLE: 'العقار غير متاح حالياً لتفعيل العرض الاحتياطي',
  OFFER_LOCK_REQUIRED: 'يجب استلام المهمة قبل تفعيل العرض الاحتياطي',
  OFFER_LOCK_CONFLICT: 'المهمة مقفولة بواسطة مشرف آخر',
  OFFER_LOCK_EXPIRED: 'انتهت مهلة القفل (15 دقيقة). يرجى إعادة استلام المهمة',
};

/** Resolves a refusal into Arabic copy, naming the lease holder when the conflict carries one. */
export function describeBackupQueueError(err: unknown): string {
  const failure = describeApiError(err);
  const holder = readLockHolderName(failure.details);
  if (holder) {
    return `المهمة مقفولة حالياً بواسطة ${holder}. يمكنك المتابعة بعد انتهاء مدة القفل أو طلب فك القفل.`;
  }
  if (failure.code && BACKUP_ERROR_MESSAGES_AR[failure.code]) {
    return BACKUP_ERROR_MESSAGES_AR[failure.code];
  }
  return failure.message || 'تعذر تنفيذ الإجراء على العرض الاحتياطي';
}

/**
 * OQ-04: surfacing is advisory priority, not a hard constraint — the administrator confirms every
 * activation. So "position 1" is marked, but activating a later row stays possible and auditable.
 */
export function resolveBackupQueueActions(
  group: Pick<BackupOfferQueueGroup, 'queueState'> | null | undefined,
  item: Pick<BackupOfferQueueItem, 'lockInfo'> | null | undefined,
  lockInfo?: OfferLockInfo,
): { canClaim: boolean; canActivate: boolean } {
  const resolvedLock = lockInfo ?? item?.lockInfo;
  const isLocked = Boolean(resolvedLock?.isLocked);
  const isLockedByCurrentAdmin = Boolean(resolvedLock?.isLockedByCurrentAdmin);

  return {
    canClaim: !isLocked || isLockedByCurrentAdmin,
    canActivate: group?.queueState === 'SURFACED' && isLockedByCurrentAdmin,
  };
}

function formatListingFacts(listing: BackupOfferQueueGroup['listing']): string {
  return [
    PROPERTY_TYPE_LABELS_AR[listing.propertyType] || listing.propertyType,
    listing.areaSquareMeters ? `م² ${listing.areaSquareMeters}` : null,
    listing.cityName,
    listing.districtName,
  ]
    .filter(Boolean)
    .join(' — ');
}

/**
 * Admin backup offer queue (Story 4.3 / FR-27, OQ-04, AD-10).
 *
 * One card per listing that still holds a reserve queue, with the derived `queueState`
 * (`SURFACED` = the primary deal is gone, the queue may be activated) and the offers inside it
 * oldest-first. Claiming and activation are explicit `POST`s; the lease is the canonical
 * `/admin/offers/:id/claim` one, so `Offer` keeps a single lease implementation.
 */
export interface BackupOfferQueueProps {
  /** SSR/test seam, mirroring `ListingModerationQueue`: pre-seeded groups skip the first fetch. */
  initialGroups?: BackupOfferQueueGroup[];
  initialTotal?: number;
}

export function BackupOfferQueue({ initialGroups, initialTotal }: BackupOfferQueueProps = {}) {
  const [groups, setGroups] = useState<BackupOfferQueueGroup[]>(initialGroups || []);
  const [total, setTotal] = useState<number>(
    initialTotal ?? (initialGroups ? initialGroups.length : 0),
  );
  const [loading, setLoading] = useState<boolean>(!initialGroups);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await apiClient.get<BackupQueuePayload>('/admin/backup-offers?page=1&limit=50');
      setGroups(res?.data?.items ?? []);
      setTotal(res?.data?.meta?.total ?? res?.data?.items?.length ?? 0);
    } catch (err) {
      setErrorBanner(describeBackupQueueError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialGroups) return;
    fetchQueue();
  }, [initialGroups, fetchQueue]);

  const runAction = async (offerId: string, request: () => Promise<unknown>) => {
    setBusyOfferId(offerId);
    setErrorBanner(null);
    try {
      await request();
      // Sticky/refresh behaviour: re-read the queue after every committed action, never poll.
      await fetchQueue();
    } catch (err) {
      setErrorBanner(describeBackupQueueError(err));
      await fetchQueue();
    } finally {
      setBusyOfferId(null);
    }
  };

  const handleClaim = (offerId: string) =>
    runAction(offerId, () => apiClient.post(`/admin/offers/${offerId}/claim`));

  const handleActivate = (offerId: string) =>
    runAction(offerId, () => apiClient.post(`/admin/backup-offers/${offerId}/activate`));

  return (
    <div dir="rtl" className="space-y-6">
      <div className="rounded-2xl bg-primary text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 text-accent-light px-3 py-1 rounded-full border border-white/10">
            <Lock className="w-3.5 h-3.5" />
            <span>قفل حصري لمدة 15 دقيقة لكل مهمة • AD-10</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <HandCoins className="w-6 h-6 text-accent" />
            <span>طابور العروض الاحتياطية</span>
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            العروض الاحتياطية المعتمدة تُحتجز على العقارات المحجوزة حتى تُقفل الصفقة الأساسية.
            يُعرض أول عرض احتياطي (الأقدم اعتماداً) للتفعيل أولاً، والتفعيل قرار إداري موثّق.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث الطابور</span>
        </button>
      </div>

      {errorBanner ? (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 flex items-center justify-between text-xs font-semibold"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-red-700 underline">
            إغلاق
          </button>
        </div>
      ) : null}

      {loading ? (
        <Card className="p-10 text-center text-sm text-ink-muted dark:text-dark-ink-muted">
          جاري تحميل طابور العروض الاحتياطية...
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="w-7 h-7" />}
          title="لا توجد عروض احتياطية في الانتظار"
          description="يظهر هنا كل عرض احتياطي معتمد على عقار محجوز، مرتباً حسب الأقدمية، مع حالة العقار وإجراء التفعيل."
        />
      ) : (
        <div className="space-y-4" data-testid="backup-offer-queue">
          <div className="text-xs text-ink-secondary dark:text-dark-ink-secondary font-medium">
            {`إجمالي العقارات في الطابور: ${total}`}
          </div>

          {groups.map((group) => (
            <Card
              key={group.listing.id}
              className="p-4"
              data-testid={`backup-group-${group.listing.id}`}
            >
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base truncate">{group.listing.title || '—'}</CardTitle>
                  <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted">
                    {formatListingFacts(group.listing)}
                  </p>
                  <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
                    سعر الطلب:{' '}
                    <span dir="ltr" className="font-mono">
                      {formatSar(group.listing.askPrice)}
                    </span>
                  </p>
                </div>
                <Badge
                  variant={group.queueState === 'SURFACED' ? 'verified' : 'neutral'}
                  data-testid={`backup-group-state-${group.listing.id}`}
                >
                  {BACKUP_QUEUE_STATE_LABELS_AR[group.queueState]}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-3">
                {group.items.map((item) => {
                  const lockInfo = item.lockInfo;
                  const actions = resolveBackupQueueActions(group, item, lockInfo);
                  const isNextInLine = item.queuePosition === 1;

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-surface-border dark:border-dark-surface-border p-3 space-y-2"
                      data-testid={`backup-offer-row-${item.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold font-mono"
                              data-testid={`backup-offer-position-${item.id}`}
                            >
                              {item.queuePosition}
                            </span>
                            <span className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary truncate">
                              {item.buyerName || 'مشتري'}
                            </span>
                            {isNextInLine ? (
                              <span
                                className="inline-flex items-center rounded-pill bg-status-verifiedBg px-2 py-0.5 text-[11px] font-bold text-status-verified border border-status-verifiedBorder"
                                data-testid={`backup-offer-next-${item.id}`}
                              >
                                التالي في الانتظار
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-ink-muted dark:text-dark-ink-muted">
                            <span dir="ltr" className="font-mono font-bold text-primary">
                              {formatSar(item.offerPrice)}
                            </span>
                            <span className="inline-flex items-center rounded-pill bg-surface-sunken dark:bg-dark-surface-sunken px-2 py-0.5 font-semibold">
                              {`جولة ${item.negotiationRound} من ${item.maxCounterRounds}`}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatOfferExpiry(item.expiresAt)}</span>
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-[11px]">
                          {!lockInfo?.isLocked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <Unlock className="w-3 h-3" />
                              <span>متاح للاستلام</span>
                            </span>
                          ) : lockInfo.isLockedByCurrentAdmin ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-primary text-white">
                              <Lock className="w-3 h-3" />
                              <span>قيد المعالجة بواسطتك</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Lock className="w-3 h-3 text-amber-700" />
                              <span>{`مقفول بواسطة ${lockInfo.lockedByAdminName || 'مشرف آخر'}`}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {actions.canClaim ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyOfferId === item.id}
                            onClick={() => handleClaim(item.id)}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>
                              {lockInfo?.isLockedByCurrentAdmin ? 'متابعة الاستلام' : 'استلام المهمة'}
                            </span>
                          </Button>
                        ) : null}

                        {actions.canActivate ? (
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={busyOfferId === item.id}
                            onClick={() => handleActivate(item.id)}
                            data-testid={`backup-offer-activate-${item.id}`}
                          >
                            <HandCoins className="w-3.5 h-3.5" />
                            <span>تفعيل العرض الاحتياطي</span>
                          </Button>
                        ) : null}

                        <Link
                          href={`/admin/negotiations/${item.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-colors"
                        >
                          <span>سجل التفاوض</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
