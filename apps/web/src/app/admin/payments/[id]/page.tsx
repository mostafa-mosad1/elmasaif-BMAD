import React from 'react';
import { PaymentReviewWorkspace } from '../../../../components/admin/payment-review-workspace';

interface AdminPaymentReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPaymentReviewPage({
  params,
}: AdminPaymentReviewPageProps) {
  const { id } = await params;
  return <PaymentReviewWorkspace paymentId={id} />;
}

