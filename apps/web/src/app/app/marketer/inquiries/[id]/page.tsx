import React from 'react';
import { InquiryThreadView } from '../../../../../components/inquiries';

interface MarketerInquiryThreadPageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketerInquiryThreadPage({
  params,
}: MarketerInquiryThreadPageProps) {
  const { id } = await params;
  return <InquiryThreadView inquiryId={id} viewer="SELLER" backHref="/app/marketer/inquiries" />;
}
