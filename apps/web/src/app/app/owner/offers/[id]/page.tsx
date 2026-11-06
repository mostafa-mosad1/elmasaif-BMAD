import React from 'react';
import { OfferNegotiationView } from '../../../../../components/offers';

interface OwnerOfferNegotiationPageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnerOfferNegotiationPage({
  params,
}: OwnerOfferNegotiationPageProps) {
  const { id } = await params;
  return <OfferNegotiationView offerId={id} viewer="SELLER" backHref="/app/owner/offers" />;
}
