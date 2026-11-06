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
import { OfferSubmitForm } from '../../../components/offers';
import { InquirySubmitForm } from '../../../components/inquiries';
import { Button, Modal } from '../../../components/ui';
import { MessageSquareText } from 'lucide-react';

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const listingId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { user } = useAuth();

  const [detail, setDetail] = useState<ListingDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ListingDetailError | null>(null);
  const [ctaNotice, setCtaNotice] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);

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

  // The offer CTA opens the offer dialog for an authenticated buyer; an anonymous visitor is
  // sent to login first so the submission always carries a session (FR-25 / Story 4.1).
  const handleCtaClick = useCallback(() => {
    if (!user) {
      if (typeof window !== 'undefined') {
        window.location.href = `/auth/login?redirect=${encodeURIComponent(
          window.location.pathname,
        )}`;
      }
      return;
    }
    setCtaNotice(null);
    setOfferOpen(true);
  }, [user]);

  // The inquiry form mirrors the offer CTA: an anonymous visitor is sent to login first, because
  // the submission is party-scoped to an active BUYER profile (Story 4.4 / AC-1).
  const handleInquiryToggle = useCallback(() => {
    if (!user) {
      if (typeof window !== 'undefined') {
        window.location.href = `/auth/login?redirect=${encodeURIComponent(
          window.location.pathname,
        )}`;
      }
      return;
    }
    setInquiryOpen(true);
  }, [user]);

  const handleInquiryClose = useCallback(() => setInquiryOpen(false), []);
  const handleOfferClose = useCallback(() => setOfferOpen(false), []);

  // Kept on the results line so the inquiry entry point is visible without scrolling to the end.
  const inquiryTrigger = detail ? (
    <Button
      type="button"
      variant="primary"
      size="md"
      onClick={handleInquiryToggle}
      data-testid="inquiry-toggle"
    >
      <MessageSquareText className="w-4 h-4" />
      <span>إرسال استفسار عن العقار</span>
    </Button>
  ) : null;

  return (
    <LayoutShell>
      <ListingDetailView
        detail={detail}
        loading={loading}
        error={error}
        onCtaClick={handleCtaClick}
        ctaNotice={ctaNotice}
        headerAction={inquiryTrigger}
      />
      {offerOpen && detail ? (
        <Modal
          open
          onClose={handleOfferClose}
          ariaLabel="نموذج تقديم عرض الشراء"
          testId="offer-modal"
          closeTestId="offer-modal-close"
        >
          <OfferSubmitForm
            listingId={detail.id}
            askPrice={detail.askPrice}
            listingStatus={detail.status}
            onSubmitted={handleOfferClose}
            onCancel={handleOfferClose}
          />
        </Modal>
      ) : null}
      {inquiryOpen && detail ? (
        <Modal
          open
          onClose={handleInquiryClose}
          ariaLabel="نموذج الاستفسار عن العقار"
          testId="inquiry-modal"
          closeTestId="inquiry-modal-close"
        >
          <InquirySubmitForm listingId={detail.id} onCancel={handleInquiryClose} />
        </Modal>
      ) : null}
    </LayoutShell>
  );
}
