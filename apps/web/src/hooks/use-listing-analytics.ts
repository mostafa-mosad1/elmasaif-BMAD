'use client';

import { useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '../lib/api-client';

export interface QueuedEngagementEvent {
  listingId: string;
  eventType: 'IMPRESSION' | 'DETAIL_VIEW';
  count?: number;
}

const FLUSH_INTERVAL_MS = 2000;
const BATCH_SIZE_THRESHOLD = 10;

// Module-level buffer to preserve queue across hook mounts/unmounts
let globalEventQueue: QueuedEngagementEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;

export function getEventQueue(): QueuedEngagementEvent[] {
  return globalEventQueue;
}

export function clearEventQueue(): void {
  globalEventQueue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

export function flushQueueSyncOrAsync() {
  if (globalEventQueue.length === 0) return;

  const eventsToSend = [...globalEventQueue];
  globalEventQueue = [];

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const url = `${getApiBaseUrl()}/listings/analytics/events`;
  const payload = JSON.stringify({ events: eventsToSend });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const success = navigator.sendBeacon(url, blob);
      if (success) return;
    } catch {
      // Fall through to fetch
    }
  }

  if (typeof fetch === 'function') {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {
      // Non-blocking: engagement analytics errors never disrupt user flow
    });
  }
}

export function scheduleFlush() {
  if (globalEventQueue.length >= BATCH_SIZE_THRESHOLD) {
    flushQueueSyncOrAsync();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushQueueSyncOrAsync();
    }, FLUSH_INTERVAL_MS);
  }
}

export function enqueueImpression(listingId: string) {
  if (!listingId) return;
  globalEventQueue.push({
    listingId,
    eventType: 'IMPRESSION',
    count: 1,
  });
  scheduleFlush();
}

export function enqueueDetailView(listingId: string) {
  if (!listingId) return;
  globalEventQueue.push({
    listingId,
    eventType: 'DETAIL_VIEW',
    count: 1,
  });
  scheduleFlush();
}

export function useListingAnalytics() {
  const flush = useCallback(() => {
    flushQueueSyncOrAsync();
  }, []);

  const recordImpression = useCallback((listingId: string) => {
    enqueueImpression(listingId);
  }, []);

  const recordDetailView = useCallback((listingId: string) => {
    enqueueDetailView(listingId);
  }, []);

  useEffect(() => {
    const handlePageHide = () => {
      flushQueueSyncOrAsync();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('beforeunload', handlePageHide);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('beforeunload', handlePageHide);
      }
    };
  }, []);

  return {
    recordImpression,
    recordDetailView,
    flush,
  };
}
