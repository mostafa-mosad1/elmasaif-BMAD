import React from 'react';
import { InquiryWorkspace } from '../../../../components/admin/inquiry-workspace';

interface AdminConversationWorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminConversationWorkspacePage({
  params,
}: AdminConversationWorkspacePageProps) {
  const { id } = await params;
  return <InquiryWorkspace inquiryId={id} />;
}
