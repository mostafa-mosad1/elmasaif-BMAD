import React from 'react';
import { DealPaymentView } from '../../../../../components/deals';

interface BuyerDealPaymentPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuyerDealPaymentPage({
  params,
}: BuyerDealPaymentPageProps) {
  const { id } = await params;
  return <DealPaymentView dealId={id} />;
}
