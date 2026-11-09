import React from 'react';
import { DisputeAdjudicationWorkspace } from '../../../../components/admin/dispute-adjudication-workspace';

interface AdminDisputeAdjudicationPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminDisputeAdjudicationPage({
  params,
}: AdminDisputeAdjudicationPageProps) {
  const { id } = await params;
  return <DisputeAdjudicationWorkspace disputeId={id} />;
}

