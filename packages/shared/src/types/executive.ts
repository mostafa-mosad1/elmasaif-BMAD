export interface ExecutiveDashboardMetricsDto {
  dealCounts48h: {
    activeInPaymentWindow: number;
    completedLast48h: number;
    pendingReviewLast48h: number;
    totalVolumeLast48hSar: number;
  };
  pendingQueues: {
    listingsModeration: number;
    falVerifications: number;
    paymentProofReviews: number;
    contractFeeReviews: number;
    unassignedDisputes: number;
    openTickets: number;
    pendingViolationReports: number;
    activeTaskClaims: number;
  };
  slaWarnings: {
    dealsExpiringSoon12h: number;
    ticketsSlaBreached: number;
    listingsPendingOver24h: number;
  };
  financialThroughput30d: {
    grossVolumeSar: number;
    commissionsSar: number;
    contractFeesSar: number;
  };
}

