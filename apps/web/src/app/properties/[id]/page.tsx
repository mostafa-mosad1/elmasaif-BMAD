'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ListingDetailItem } from '@elmasaif/shared';
import { LayoutShell } from '../../../components/layout';
import {
  ListingDetailView,
  ListingDetailError,
  toDetailError,
  unwrapDetailResponse,
} from './listing-detail-view';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../components/providers/auth-provider';

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const listingId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { user } = useAuth();

  const [detail, setDetail] = useState<ListingDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ListingDetailError | null>(null);
  const [ctaNotice, setCtaNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .get<ListingDetailItem>(`/listings/${listingId}`)
      .then((response) => {
        if (cancelled) return;
        setDetail(unwrapDetailResponse(response));
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setError(toDetailError(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  // Offer intake is Epic 4 — this screen only routes or queues the buyer's intent.
  const handleCtaClick = useCallback(() => {
    if (!user) {
      if (typeof window !== 'undefined') {
        window.location.href = `/auth/login?redirect=${encodeURIComponent(
          window.location.pathname,
        )}`;
      }
      return;
    }
    setCtaNotice(
      'تم تسجيل اهتمامك بهذا العقار. تفتح منصة المصايف استقبال العروض الرسمية مع إطلاق مرحلة التفاوض بإشراف إداري.',
    );
  }, [user]);

  return (
    <LayoutShell>
      <ListingDetailView
        detail={detail}
        loading={loading}
        error={error}
        onCtaClick={handleCtaClick}
        ctaNotice={ctaNotice}
      />
    </LayoutShell>
  );
}
