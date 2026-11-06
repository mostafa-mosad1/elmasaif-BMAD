import React from 'react';
import { InquiriesView } from '../../../../components/inquiries';

export default function OwnerInquiriesPage() {
  return <InquiriesView viewer="SELLER" detailHrefBase="/app/owner/inquiries" />;
}
