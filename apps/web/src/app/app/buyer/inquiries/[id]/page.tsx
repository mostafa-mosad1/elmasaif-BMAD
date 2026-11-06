import React from 'react';
import { InquiryThreadView } from '../../../../../components/inquiries';

interface BuyerInquiryThreadPageProps {
  params: Promise<{ id: string }>;
}

export default async function BuyerInquiryThreadPage({ params }: BuyerInquiryThreadPageProps) {
  const { id } = await params;
  return <InquiryThreadView inquiryId={id} viewer="BUYER" backHref="/app/buyer/inquiries" />;
}
