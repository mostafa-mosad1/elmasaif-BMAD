import React from 'react';
import { OfferNegotiationView } from '../../../../../components/offers';

interface BuyerOfferNegotiationPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuyerOfferNegotiationPage({
  params,
}: BuyerOfferNegotiationPageProps) {
  const { id } = await params;
  return <OfferNegotiationView offerId={id} viewer="BUYER" backHref="/app/buyer/offers" />;
}
