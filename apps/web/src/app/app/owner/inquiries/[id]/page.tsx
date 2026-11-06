import React from 'react';
import { InquiryThreadView } from '../../../../../components/inquiries';

interface OwnerInquiryThreadPageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnerInquiryThreadPage({ params }: OwnerInquiryThreadPageProps) {
  const { id } = await params;
  return <InquiryThreadView inquiryId={id} viewer="SELLER" backHref="/app/owner/inquiries" />;
}
