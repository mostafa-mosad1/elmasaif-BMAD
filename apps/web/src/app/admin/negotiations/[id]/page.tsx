import React from 'react';
import { OfferMediationWorkspace } from '../../../../components/admin/offer-mediation-workspace';

interface AdminNegotiationWorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminNegotiationWorkspacePage({
  params,
}: AdminNegotiationWorkspacePageProps) {
  const { id } = await params;
  return <OfferMediationWorkspace offerId={id} />;
}
