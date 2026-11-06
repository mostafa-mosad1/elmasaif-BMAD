import React from 'react';
import { OfferNegotiationView } from '../../../../../components/offers';

interface MarketerOfferNegotiationPageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketerOfferNegotiationPage({
  params,
}: MarketerOfferNegotiationPageProps) {
  const { id } = await params;
  return <OfferNegotiationView offerId={id} viewer="SELLER" backHref="/app/marketer/offers" />;
}
