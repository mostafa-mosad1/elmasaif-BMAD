'use client';

import { MatchingDemandsView } from '../../../../components/proposals';

/**
 * Owner workspace mirror of `/app/marketer/demands`. An OWNER is a provider profile
 * (`PROVIDER_PROFILE_ROLES` in ProposalsService), so the matching-demand alert surface and
 * the binding proposal form must be reachable from the owner workspace too.
 */
export default function OwnerDemandsPage() {
  return <MatchingDemandsView />;
}
