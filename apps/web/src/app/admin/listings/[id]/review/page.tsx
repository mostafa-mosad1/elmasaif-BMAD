import React from 'react';
import { ListingModerationReview } from '../../../../../components/admin/listing-moderation-review';

interface AdminListingReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminListingReviewPage({
  params,
}: AdminListingReviewPageProps) {
  const { id } = await params;
  return <ListingModerationReview listingId={id} />;
}

