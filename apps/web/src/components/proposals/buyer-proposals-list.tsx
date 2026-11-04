'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProposalStatus, PROPERTY_TYPE_LABELS_AR } from '@elmasaif/shared';
import { HandCoins, MapPin } from 'lucide-react';
import { Button, EmptyState } from '../ui';
import { apiClient, ApiError } from '../../lib/api-client';
import { BuyerProposalItem } from './proposal-item';
import { ProposalStatusBadge } from './proposal-status-badge';

interface ProposalsPayload {
  items?: BuyerProposalItem[];
  data?: { items?: BuyerProposalItem[] };
}

/** Envelope-tolerant reader (bare `{ items }` OR `{ statusCode, data: { items } }`). */
export function unwrapProposalsPayload(payload: unknown): BuyerProposalItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const { items, data } = payload as ProposalsPayload;
  const wrapped = data?.items;
  if (Array.isArray(wrapped)) return wrapped;
  if (Array.isArray(items)) return items;
  return [];
}

const formatSar = (value: number): string => Number(value || 0).toLocaleString('en-US');

export interface BuyerProposalsListProps {
  proposals: BuyerProposalItem[];
  onSelect: (proposalId: string) => void;
  selectingId?: string | null;
}

/**
 * Pure presentational buyer review list (Story 3.7 / FR-24): renders only the proposals the
 * API already filtered to `APPROVED_FOR_BUYER`, each with a light listing summary, the
 * provider broker badge, and the binding price. The "اختر العرض" affordance renders for an
 * `APPROVED_FOR_BUYER` row and is absent for every other status. Exported so SSR tests can
 * render it independently of the fetch wrapper.
 */
export function BuyerProposalsList({
  proposals,
  onSelect,
  selectingId = null,
}: BuyerProposalsListProps) {
  return (
    <ul className="space-y-3" data-testid="buyer-proposals-list">
      {proposals.map((proposal) => {
        const selectable = proposal.status === ProposalStatus.APPROVED_FOR_BUYER;
        const listing = proposal.listing;
        return (
          <li
            key={proposal.id}
            className="rounded-xl border border-surface-border dark:border-dark-surface-border p-4 space-y-2"
            data-testid={`buyer-proposal-row-${proposal.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary truncate">
                  {listing?.title ?? '—'}
                </div>
                {listing ? (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {[
                        PROPERTY_TYPE_LABELS_AR[listing.propertyType as keyof typeof PROPERTY_TYPE_LABELS_AR] ||
                          listing.propertyType,
                        listing.cityName,
                        listing.districtName,
                      ]
                        .filter(Boolean)
                        .join(' — ')}
                    </span>
                  </p>
                ) : null}
              </div>
              <ProposalStatusBadge status={proposal.status} />
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-secondary dark:text-dark-ink-secondary">
                الوسيط: <span className="font-semibold">{proposal.providerName ?? 'غير معروف'}</span>
              </span>
              <span dir="ltr" className="font-mono font-bold text-primary">
                {`${formatSar(proposal.proposedPrice)} ر.س`}
              </span>
            </div>

            {proposal.note ? (
              <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary line-clamp-2">
                {proposal.note}
              </p>
            ) : null}

            {selectable ? (
              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSelect(proposal.id)}
                  disabled={selectingId === proposal.id}
                  className="text-xs gap-1.5"
                  data-testid={`buyer-proposal-select-${proposal.id}`}
                >
                  <HandCoins className="w-3.5 h-3.5" />
                  <span>{selectingId === proposal.id ? 'جاري الاختيار...' : 'اختر العرض'}</span>
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export interface BuyerProposalsSectionProps {
  demandId: string;
}

/**
 * Buyer-facing proposals section wired into the demand screen (Story 3.7 / AC#5). Fetches the
 * approved proposals for the caller's OWN demand, and selecting one moves it to
 * `SELECTED_PENDING_FINAL_ADMIN_APPROVAL` (siblings close server-side) then refreshes the list.
 * Final Deal creation stays in Story 5.1.
 */
export function BuyerProposalsSection({ demandId }: BuyerProposalsSectionProps) {
  const [proposals, setProposals] = useState<BuyerProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get<ProposalsPayload>(`/proposals/demand/${demandId}`)
      .then((payload) => {
        setProposals(unwrapProposalsPayload(payload));
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر تحميل العروض المتاحة.');
        setLoading(false);
      });
  }, [demandId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (proposalId: string) => {
    setSelectingId(proposalId);
    try {
      await apiClient.post(`/proposals/${proposalId}/select`);
      load();
    } catch (err) {
      setError(
        err instanceof ApiError && err.message ? err.message : 'تعذر اختيار العرض.',
      );
    } finally {
      setSelectingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<HandCoins className="w-6 h-6" />}
        title={error}
        description="أعد المحاولة بعد قليل."
        actionLabel="إعادة المحاولة"
        onAction={load}
      />
    );
  }

  if (proposals.length === 0) {
    return (
      <p className="text-xs text-ink-muted dark:text-dark-ink-muted" data-testid="buyer-proposals-empty">
        لا توجد عروض معتمدة لهذا الطلب بعد.
      </p>
    );
  }

  return <BuyerProposalsList proposals={proposals} onSelect={handleSelect} selectingId={selectingId} />;
}
