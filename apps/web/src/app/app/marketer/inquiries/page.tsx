import React from 'react';
import { InquiriesView } from '../../../../components/inquiries';

export default function MarketerInquiriesPage() {
  return <InquiriesView viewer="SELLER" detailHrefBase="/app/marketer/inquiries" />;
}
