import React from 'react';
import {
  MAX_COUNTER_ROUNDS,
  OFFER_HISTORY_ACTION_LABELS_AR,
  OfferHistoryEntry,
} from '@elmasaif/shared';
import { formatSar } from '../listings/commission-calculator';

const HISTORY_ACTION_LABELS = OFFER_HISTORY_ACTION_LABELS_AR as Record<string, string>;

/** UX-DR-10: who performed a timeline step. Admins have no `UserProfile`, hence `ACTOR`-level labels. */
export const OFFER_HISTORY_ACTOR_LABELS_AR: Record<OfferHistoryEntry['actorRole'], string> = {
  BUYER: 'المشتري',
  SELLER: 'البائع',
  ADMIN: 'إدارة المنصة',
  SYSTEM: 'النظام',
};

const ACTOR_CHIP_STYLES: Record<OfferHistoryEntry['actorRole'], string> = {
  BUYER: 'bg-status-infoBg text-status-info border-status-infoBorder',
  SELLER: 'bg-status-verifiedBg text-status-verified border-status-verifiedBorder',
  ADMIN: 'bg-status-pendingBg text-status-pending border-status-pendingBorder',
  SYSTEM: 'bg-status-neutralBg text-status-neutral border-status-neutralBorder',
};

/**
 * One timeline instant rendered in Saudi time (UX-DR-13). `toLocaleString` is browser- and
 * Node-ICU-dependent, so tests assert on the labels rather than on the formatted digits.
 */
export function formatHistoryTimestamp(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
}

/** Falls back to the raw code so an unmapped future action never renders blank. */
export function resolveHistoryActionLabel(action: string): string {
  return HISTORY_ACTION_LABELS[action] ?? String(action);
}

export interface OfferNegotiationTimelineProps {
  history: OfferHistoryEntry[];
  className?: string;
}

/**
 * Mediated negotiation timeline (Story 4.2 / AC#8, UX-DR-10, UX-DR-13): a vertical RTL rail
 * carrying every `OfferHistory` row in chronological order — action label, actor chip, round
 * chip, price snapshot, counterparty note and a Saudi-time timestamp. Purely presentational so
 * the SSR suite can render it without a DOM.
 */
export function OfferNegotiationTimeline({
  history,
  className = '',
}: OfferNegotiationTimelineProps) {
  const entries = Array.isArray(history) ? history : [];

  if (entries.length === 0) {
    return (
      <div
        className={`rounded-card border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken p-4 ${className}`}
        data-testid="offer-negotiation-timeline"
        data-empty="true"
      >
        <p className="text-sm text-ink-muted dark:text-dark-ink-muted">لم يبدأ التفاوض بعد</p>
      </div>
    );
  }

  return (
    <ol
      className={`relative space-y-5 border-s-2 border-surface-border dark:border-dark-surface-border ps-6 ${className}`}
      data-testid="offer-negotiation-timeline"
      dir="rtl"
    >
      {entries.map((entry) => {
        const actorLabel =
          OFFER_HISTORY_ACTOR_LABELS_AR[entry.actorRole] ?? OFFER_HISTORY_ACTOR_LABELS_AR.SYSTEM;
        const actorStyles = ACTOR_CHIP_STYLES[entry.actorRole] ?? ACTOR_CHIP_STYLES.SYSTEM;

        return (
          <li
            key={entry.id}
            className="relative"
            data-testid={`offer-timeline-entry-${entry.id}`}
          >
            <span
              className="absolute -start-[31px] top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-surface dark:ring-dark-surface-raised"
              aria-hidden="true"
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                {resolveHistoryActionLabel(entry.action)}
              </span>
              <span
                className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${actorStyles}`}
                data-testid={`offer-timeline-actor-${entry.id}`}
              >
                {actorLabel}
              </span>
              {typeof entry.roundNumber === 'number' ? (
                <span
                  className="inline-flex items-center rounded-pill bg-surface-sunken dark:bg-dark-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary"
                  data-testid={`offer-timeline-round-${entry.id}`}
                >
                  {`الجولة ${entry.roundNumber} من ${MAX_COUNTER_ROUNDS}`}
                </span>
              ) : null}
            </div>

            {entry.priceSnapshot !== null && entry.priceSnapshot !== undefined ? (
              <p className="mt-1 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                السعر:{' '}
                <span dir="ltr" className="font-mono font-bold text-primary">
                  {formatSar(entry.priceSnapshot)}
                </span>
              </p>
            ) : null}

            {entry.notes ? (
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
                {entry.notes}
              </p>
            ) : null}

            <p
              className="mt-1 text-[11px] text-ink-muted dark:text-dark-ink-muted"
              data-testid={`offer-timeline-time-${entry.id}`}
            >
              {formatHistoryTimestamp(entry.createdAt)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
