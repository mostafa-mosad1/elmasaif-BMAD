import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import {
  AdminRejectPaymentBodyInput,
  DEAL_PAYMENT_STATUS,
  PaymentForceUnlockInput,
  PaymentQueueQuery,
} from '@elmasaif/shared';

/**
 * Story 5.3 / Task 5: Swagger-facing mirrors of the admin payment-review contracts.
 * `ZodValidationPipe` remains the runtime validator; these classes only document the bodies.
 */

/** AC-3: the reject body. Full 5–500 check runs in `AdminPaymentsService.rejectPayment`. */
export class AdminRejectPaymentDto implements AdminRejectPaymentBodyInput {
  @ApiPropertyOptional({
    description: 'Mandatory rejection note (5–500 chars, validated by the service)',
    maxLength: 500,
  })
  @Allow()
  reason?: string;
}

/** AC-7: force-unlock always carries a documented reason (≥ 5 chars, service-checked). */
export class ForceUnlockPaymentDto implements PaymentForceUnlockInput {
  @ApiProperty({ description: 'Documented reason for breaking the audit lease (≥ 5 chars)' })
  @Allow()
  reason!: string;
}

/** AC-1: queue query mirror of `paymentQueueQuerySchema`. */
export class PaymentQueueQueryDto implements PaymentQueueQuery {
  @ApiPropertyOptional({
    description: 'Narrow the audit queue to one proof-review status',
    enum: [DEAL_PAYMENT_STATUS.PROOF_UPLOADED, DEAL_PAYMENT_STATUS.UNDER_REVIEW],
  })
  @Allow()
  status?: Extract<PaymentQueueQuery['status'], string>;

  @ApiPropertyOptional({ description: '1-based page number', minimum: 1 })
  @Allow()
  page!: number;

  @ApiPropertyOptional({ description: 'Page size (max 100)', minimum: 1, maximum: 100 })
  @Allow()
  limit!: number;
}
