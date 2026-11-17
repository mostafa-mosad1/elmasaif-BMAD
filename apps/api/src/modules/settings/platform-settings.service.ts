import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  DEFAULT_PLATFORM_COMMISSION_PERCENTAGE,
  DEFAULT_FIXED_COMMISSION_SAR,
  DEFAULT_OWNER_CONTRACT_FEE_SAR,
  DEFAULT_VAT_RATE_PERCENTAGE,
  DEFAULT_PAYMENT_WINDOW_HOURS,
  DEFAULT_PAYMENT_CORRECTION_HOURS,
  DEFAULT_CONTRACT_FEE_DEADLINE_DAYS,
  DEFAULT_COOLING_OFF_PERIOD_DAYS,
  DEFAULT_DEAL_REVIEW_SLA_ALERT_HOURS,
  DEFAULT_DEAL_REVIEW_SLA_ESCALATION_HOURS,
  DEFAULT_DEAL_REVIEW_SLA_SUPERADMIN_DECISION_HOURS,
  DEFAULT_TICKET_SLA_FIRST_RESPONSE_HOURS,
  DEFAULT_TICKET_SLA_RESOLUTION_HOURS,
  DEFAULT_TASK_CLAIM_LEASE_MINUTES,
  DEFAULT_TASK_CLAIM_HEARTBEAT_MINUTES,
  DEFAULT_FRAUD_REJECTED_PROOF_THRESHOLD,
  DEFAULT_FRAUD_WINDOW_HOURS,
  PLATFORM_SETTINGS_UPDATED,
  PlatformSettingsDto,
  PublicPlatformSettingsDto,
  UpdatePlatformSettingsInput,
  PlatformSettingsAuditEntryDto,
} from '@elmasaif/shared';

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private cachedSettings: PlatformSettingsDto | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute in-memory cache TTL

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds the fallback settings DTO populated with canonical defaults.
   */
  getDefaultSettingsDto(): PlatformSettingsDto {
    const nowIso = new Date().toISOString();
    return {
      id: 'default',
      commissionRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      commissionRatePercentage: DEFAULT_PLATFORM_COMMISSION_PERCENTAGE,
      fixedFeeAmountSar: Number(DEFAULT_FIXED_COMMISSION_SAR),
      ownerContractFeeSar: DEFAULT_OWNER_CONTRACT_FEE_SAR,
      vatRatePercentage: DEFAULT_VAT_RATE_PERCENTAGE,
      platformCollectionIban: 'SA4210000001234567890123',
      platformAccountHolderName: 'شركة المصايف العقارية المحدودة',
      platformBankName: 'البنك الأهلي السعودي',
      paymentWindowHours: DEFAULT_PAYMENT_WINDOW_HOURS,
      paymentCorrectionHours: DEFAULT_PAYMENT_CORRECTION_HOURS,
      contractFeeDeadlineDays: DEFAULT_CONTRACT_FEE_DEADLINE_DAYS,
      coolingOffPeriodDays: DEFAULT_COOLING_OFF_PERIOD_DAYS,
      dealReviewSlaAlertHours: DEFAULT_DEAL_REVIEW_SLA_ALERT_HOURS,
      dealReviewSlaEscalationHours: DEFAULT_DEAL_REVIEW_SLA_ESCALATION_HOURS,
      dealReviewSlaSuperAdminHours: DEFAULT_DEAL_REVIEW_SLA_SUPERADMIN_DECISION_HOURS,
      ticketSlaFirstResponseHours: DEFAULT_TICKET_SLA_FIRST_RESPONSE_HOURS,
      ticketSlaResolutionHours: DEFAULT_TICKET_SLA_RESOLUTION_HOURS,
      taskClaimLeaseMinutes: DEFAULT_TASK_CLAIM_LEASE_MINUTES,
      taskClaimHeartbeatMinutes: DEFAULT_TASK_CLAIM_HEARTBEAT_MINUTES,
      fraudRejectedProofThreshold: DEFAULT_FRAUD_REJECTED_PROOF_THRESHOLD,
      fraudWindowHours: DEFAULT_FRAUD_WINDOW_HOURS,
      updatedByAdminId: null,
      updatedByAdminName: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  /**
   * Maps a Prisma PlatformSetting row to PlatformSettingsDto.
   */
  private mapToDto(setting: any): PlatformSettingsDto {
    const rate = Number(setting.commissionRate);
    return {
      id: setting.id,
      commissionRate: rate,
      commissionRatePercentage: Number((rate * 100).toFixed(2)),
      fixedFeeAmountSar: Number(setting.fixedFeeSar),
      ownerContractFeeSar: Number(setting.ownerContractFeeSar),
      vatRatePercentage: Number(setting.vatRate),
      platformCollectionIban: setting.platformCollectionIban ?? null,
      platformAccountHolderName: setting.platformAccountHolderName ?? null,
      platformBankName: setting.platformBankName ?? null,
      paymentWindowHours: setting.paymentWindowHours,
      paymentCorrectionHours: setting.paymentCorrectionHours,
      contractFeeDeadlineDays: setting.contractFeeDeadlineDays,
      coolingOffPeriodDays: setting.coolingOffPeriodDays,
      dealReviewSlaAlertHours: setting.dealReviewSlaAlertHours,
      dealReviewSlaEscalationHours: setting.dealReviewSlaEscalationHours,
      dealReviewSlaSuperAdminHours: setting.dealReviewSlaSuperAdminHours,
      ticketSlaFirstResponseHours: setting.ticketSlaFirstResponseHours,
      ticketSlaResolutionHours: setting.ticketSlaResolutionHours,
      taskClaimLeaseMinutes: setting.taskClaimLeaseMinutes,
      taskClaimHeartbeatMinutes: setting.taskClaimHeartbeatMinutes,
      fraudRejectedProofThreshold: setting.fraudRejectedProofThreshold,
      fraudWindowHours: setting.fraudWindowHours,
      updatedByAdminId: setting.updatedByAdminId ?? null,
      updatedByAdminName: setting.updatedByAdmin?.fullName ?? null,
      createdAt: setting.createdAt instanceof Date ? setting.createdAt.toISOString() : setting.createdAt,
      updatedAt: setting.updatedAt instanceof Date ? setting.updatedAt.toISOString() : setting.updatedAt,
    };
  }

  /**
   * Retrieves active settings with caching. Falls back to canonical defaults if missing.
   */
  async getSettings(): Promise<PlatformSettingsDto> {
    const now = Date.now();
    if (this.cachedSettings && now < this.cacheExpiry) {
      return this.cachedSettings;
    }

    try {
      const record = await this.prisma.platformSetting.findUnique({
        where: { id: 'default' },
        include: {
          updatedByAdmin: {
            select: { fullName: true },
          },
        },
      });

      if (!record) {
        const fallback = this.getDefaultSettingsDto();
        this.cachedSettings = fallback;
        this.cacheExpiry = now + this.CACHE_TTL_MS;
        return fallback;
      }

      const dto = this.mapToDto(record);
      this.cachedSettings = dto;
      this.cacheExpiry = now + this.CACHE_TTL_MS;
      return dto;
    } catch (err) {
      this.logger.error('Failed to load platform settings from database, using canonical fallback', err);
      return this.getDefaultSettingsDto();
    }
  }

  /**
   * Returns current cached settings synchronously if available.
   */
  getSettingsSync(): PlatformSettingsDto | null {
    return this.cachedSettings;
  }

  /**
   * Returns safe public parameters for buyers and public calculation widgets.
   */
  async getPublicSettings(): Promise<PublicPlatformSettingsDto> {
    const settings = await this.getSettings();
    return {
      commissionRate: settings.commissionRate,
      commissionRatePercentage: settings.commissionRatePercentage,
      fixedFeeAmountSar: settings.fixedFeeAmountSar,
      ownerContractFeeSar: settings.ownerContractFeeSar,
      vatRatePercentage: settings.vatRatePercentage,
      paymentWindowHours: settings.paymentWindowHours,
    };
  }

  /**
   * Invalidate the in-memory cache manually.
   */
  invalidateCache(): void {
    this.cachedSettings = null;
    this.cacheExpiry = 0;
  }

  /**
   * Atomic settings update with mandatory audit log and cache invalidation.
   */
  async updateSettings(
    input: UpdatePlatformSettingsInput,
    admin: { id: string; fullName: string },
    ipAddress?: string,
  ): Promise<PlatformSettingsDto> {
    const current = await this.getSettings();

    // Prepare delta fields
    const dataToUpdate: Prisma.PlatformSettingUpdateInput = {
      updatedByAdmin: { connect: { id: admin.id } },
    };

    const changedKeys: string[] = [];
    const previousValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    let commissionRateDec: Prisma.Decimal | undefined;
    let fixedFeeDec: Prisma.Decimal | undefined;
    let ownerContractFeeDec: Prisma.Decimal | undefined;
    let vatRateDec: Prisma.Decimal | undefined;

    if (input.commissionRatePercentage !== undefined) {
      const newRate = Number((input.commissionRatePercentage / 100).toFixed(4));
      if (newRate !== current.commissionRate) {
        commissionRateDec = new Prisma.Decimal(newRate);
        dataToUpdate.commissionRate = commissionRateDec;
        changedKeys.push('commissionRatePercentage');
        previousValues['commissionRatePercentage'] = current.commissionRatePercentage;
        newValues['commissionRatePercentage'] = input.commissionRatePercentage;
      }
    }

    if (input.fixedFeeAmountSar !== undefined && input.fixedFeeAmountSar !== current.fixedFeeAmountSar) {
      fixedFeeDec = new Prisma.Decimal(input.fixedFeeAmountSar);
      dataToUpdate.fixedFeeSar = fixedFeeDec;
      changedKeys.push('fixedFeeAmountSar');
      previousValues['fixedFeeAmountSar'] = current.fixedFeeAmountSar;
      newValues['fixedFeeAmountSar'] = input.fixedFeeAmountSar;
    }

    if (input.ownerContractFeeSar !== undefined && input.ownerContractFeeSar !== current.ownerContractFeeSar) {
      ownerContractFeeDec = new Prisma.Decimal(input.ownerContractFeeSar);
      dataToUpdate.ownerContractFeeSar = ownerContractFeeDec;
      changedKeys.push('ownerContractFeeSar');
      previousValues['ownerContractFeeSar'] = current.ownerContractFeeSar;
      newValues['ownerContractFeeSar'] = input.ownerContractFeeSar;
    }

    if (input.vatRatePercentage !== undefined && input.vatRatePercentage !== current.vatRatePercentage) {
      vatRateDec = new Prisma.Decimal(input.vatRatePercentage);
      dataToUpdate.vatRate = vatRateDec;
      changedKeys.push('vatRatePercentage');
      previousValues['vatRatePercentage'] = current.vatRatePercentage;
      newValues['vatRatePercentage'] = input.vatRatePercentage;
    }

    if (input.paymentWindowHours !== undefined && input.paymentWindowHours !== current.paymentWindowHours) {
      dataToUpdate.paymentWindowHours = input.paymentWindowHours;
      changedKeys.push('paymentWindowHours');
      previousValues['paymentWindowHours'] = current.paymentWindowHours;
      newValues['paymentWindowHours'] = input.paymentWindowHours;
    }

    if (input.paymentCorrectionHours !== undefined && input.paymentCorrectionHours !== current.paymentCorrectionHours) {
      dataToUpdate.paymentCorrectionHours = input.paymentCorrectionHours;
      changedKeys.push('paymentCorrectionHours');
      previousValues['paymentCorrectionHours'] = current.paymentCorrectionHours;
      newValues['paymentCorrectionHours'] = input.paymentCorrectionHours;
    }

    if (input.contractFeeDeadlineDays !== undefined && input.contractFeeDeadlineDays !== current.contractFeeDeadlineDays) {
      dataToUpdate.contractFeeDeadlineDays = input.contractFeeDeadlineDays;
      changedKeys.push('contractFeeDeadlineDays');
      previousValues['contractFeeDeadlineDays'] = current.contractFeeDeadlineDays;
      newValues['contractFeeDeadlineDays'] = input.contractFeeDeadlineDays;
    }

    if (input.coolingOffPeriodDays !== undefined && input.coolingOffPeriodDays !== current.coolingOffPeriodDays) {
      dataToUpdate.coolingOffPeriodDays = input.coolingOffPeriodDays;
      changedKeys.push('coolingOffPeriodDays');
      previousValues['coolingOffPeriodDays'] = current.coolingOffPeriodDays;
      newValues['coolingOffPeriodDays'] = input.coolingOffPeriodDays;
    }

    if (input.dealReviewSlaAlertHours !== undefined && input.dealReviewSlaAlertHours !== current.dealReviewSlaAlertHours) {
      dataToUpdate.dealReviewSlaAlertHours = input.dealReviewSlaAlertHours;
      changedKeys.push('dealReviewSlaAlertHours');
      previousValues['dealReviewSlaAlertHours'] = current.dealReviewSlaAlertHours;
      newValues['dealReviewSlaAlertHours'] = input.dealReviewSlaAlertHours;
    }

    if (input.dealReviewSlaEscalationHours !== undefined && input.dealReviewSlaEscalationHours !== current.dealReviewSlaEscalationHours) {
      dataToUpdate.dealReviewSlaEscalationHours = input.dealReviewSlaEscalationHours;
      changedKeys.push('dealReviewSlaEscalationHours');
      previousValues['dealReviewSlaEscalationHours'] = current.dealReviewSlaEscalationHours;
      newValues['dealReviewSlaEscalationHours'] = input.dealReviewSlaEscalationHours;
    }

    if (input.dealReviewSlaSuperAdminHours !== undefined && input.dealReviewSlaSuperAdminHours !== current.dealReviewSlaSuperAdminHours) {
      dataToUpdate.dealReviewSlaSuperAdminHours = input.dealReviewSlaSuperAdminHours;
      changedKeys.push('dealReviewSlaSuperAdminHours');
      previousValues['dealReviewSlaSuperAdminHours'] = current.dealReviewSlaSuperAdminHours;
      newValues['dealReviewSlaSuperAdminHours'] = input.dealReviewSlaSuperAdminHours;
    }

    if (input.ticketSlaFirstResponseHours !== undefined && input.ticketSlaFirstResponseHours !== current.ticketSlaFirstResponseHours) {
      dataToUpdate.ticketSlaFirstResponseHours = input.ticketSlaFirstResponseHours;
      changedKeys.push('ticketSlaFirstResponseHours');
      previousValues['ticketSlaFirstResponseHours'] = current.ticketSlaFirstResponseHours;
      newValues['ticketSlaFirstResponseHours'] = input.ticketSlaFirstResponseHours;
    }

    if (input.ticketSlaResolutionHours !== undefined && input.ticketSlaResolutionHours !== current.ticketSlaResolutionHours) {
      dataToUpdate.ticketSlaResolutionHours = input.ticketSlaResolutionHours;
      changedKeys.push('ticketSlaResolutionHours');
      previousValues['ticketSlaResolutionHours'] = current.ticketSlaResolutionHours;
      newValues['ticketSlaResolutionHours'] = input.ticketSlaResolutionHours;
    }

    if (input.taskClaimLeaseMinutes !== undefined && input.taskClaimLeaseMinutes !== current.taskClaimLeaseMinutes) {
      dataToUpdate.taskClaimLeaseMinutes = input.taskClaimLeaseMinutes;
      changedKeys.push('taskClaimLeaseMinutes');
      previousValues['taskClaimLeaseMinutes'] = current.taskClaimLeaseMinutes;
      newValues['taskClaimLeaseMinutes'] = input.taskClaimLeaseMinutes;
    }

    if (input.taskClaimHeartbeatMinutes !== undefined && input.taskClaimHeartbeatMinutes !== current.taskClaimHeartbeatMinutes) {
      dataToUpdate.taskClaimHeartbeatMinutes = input.taskClaimHeartbeatMinutes;
      changedKeys.push('taskClaimHeartbeatMinutes');
      previousValues['taskClaimHeartbeatMinutes'] = current.taskClaimHeartbeatMinutes;
      newValues['taskClaimHeartbeatMinutes'] = input.taskClaimHeartbeatMinutes;
    }

    if (input.fraudRejectedProofThreshold !== undefined && input.fraudRejectedProofThreshold !== current.fraudRejectedProofThreshold) {
      dataToUpdate.fraudRejectedProofThreshold = input.fraudRejectedProofThreshold;
      changedKeys.push('fraudRejectedProofThreshold');
      previousValues['fraudRejectedProofThreshold'] = current.fraudRejectedProofThreshold;
      newValues['fraudRejectedProofThreshold'] = input.fraudRejectedProofThreshold;
    }

    if (input.fraudWindowHours !== undefined && input.fraudWindowHours !== current.fraudWindowHours) {
      dataToUpdate.fraudWindowHours = input.fraudWindowHours;
      changedKeys.push('fraudWindowHours');
      previousValues['fraudWindowHours'] = current.fraudWindowHours;
      newValues['fraudWindowHours'] = input.fraudWindowHours;
    }

    if (input.platformCollectionIban !== undefined && input.platformCollectionIban !== current.platformCollectionIban) {
      dataToUpdate.platformCollectionIban = input.platformCollectionIban;
      changedKeys.push('platformCollectionIban');
      previousValues['platformCollectionIban'] = current.platformCollectionIban;
      newValues['platformCollectionIban'] = input.platformCollectionIban;
    }

    if (input.platformAccountHolderName !== undefined && input.platformAccountHolderName !== current.platformAccountHolderName) {
      dataToUpdate.platformAccountHolderName = input.platformAccountHolderName;
      changedKeys.push('platformAccountHolderName');
      previousValues['platformAccountHolderName'] = current.platformAccountHolderName;
      newValues['platformAccountHolderName'] = input.platformAccountHolderName;
    }

    if (input.platformBankName !== undefined && input.platformBankName !== current.platformBankName) {
      dataToUpdate.platformBankName = input.platformBankName;
      changedKeys.push('platformBankName');
      previousValues['platformBankName'] = current.platformBankName;
      newValues['platformBankName'] = input.platformBankName;
    }

    // Execute interactive transaction: update/upsert settings and append AuditLog
    const updatedRecord = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.platformSetting.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          commissionRate: commissionRateDec ?? new Prisma.Decimal(DEFAULT_PLATFORM_COMMISSION_RATE),
          fixedFeeSar: fixedFeeDec ?? new Prisma.Decimal(DEFAULT_FIXED_COMMISSION_SAR),
          ownerContractFeeSar: ownerContractFeeDec ?? new Prisma.Decimal(DEFAULT_OWNER_CONTRACT_FEE_SAR),
          vatRate: vatRateDec ?? new Prisma.Decimal(DEFAULT_VAT_RATE_PERCENTAGE),
          paymentWindowHours: (dataToUpdate.paymentWindowHours as number) ?? DEFAULT_PAYMENT_WINDOW_HOURS,
          paymentCorrectionHours: (dataToUpdate.paymentCorrectionHours as number) ?? DEFAULT_PAYMENT_CORRECTION_HOURS,
          contractFeeDeadlineDays: (dataToUpdate.contractFeeDeadlineDays as number) ?? DEFAULT_CONTRACT_FEE_DEADLINE_DAYS,
          coolingOffPeriodDays: (dataToUpdate.coolingOffPeriodDays as number) ?? DEFAULT_COOLING_OFF_PERIOD_DAYS,
          dealReviewSlaAlertHours: (dataToUpdate.dealReviewSlaAlertHours as number) ?? DEFAULT_DEAL_REVIEW_SLA_ALERT_HOURS,
          dealReviewSlaEscalationHours: (dataToUpdate.dealReviewSlaEscalationHours as number) ?? DEFAULT_DEAL_REVIEW_SLA_ESCALATION_HOURS,
          dealReviewSlaSuperAdminHours: (dataToUpdate.dealReviewSlaSuperAdminHours as number) ?? DEFAULT_DEAL_REVIEW_SLA_SUPERADMIN_DECISION_HOURS,
          ticketSlaFirstResponseHours: (dataToUpdate.ticketSlaFirstResponseHours as number) ?? DEFAULT_TICKET_SLA_FIRST_RESPONSE_HOURS,
          ticketSlaResolutionHours: (dataToUpdate.ticketSlaResolutionHours as number) ?? DEFAULT_TICKET_SLA_RESOLUTION_HOURS,
          taskClaimLeaseMinutes: (dataToUpdate.taskClaimLeaseMinutes as number) ?? DEFAULT_TASK_CLAIM_LEASE_MINUTES,
          taskClaimHeartbeatMinutes: (dataToUpdate.taskClaimHeartbeatMinutes as number) ?? DEFAULT_TASK_CLAIM_HEARTBEAT_MINUTES,
          fraudRejectedProofThreshold: (dataToUpdate.fraudRejectedProofThreshold as number) ?? DEFAULT_FRAUD_REJECTED_PROOF_THRESHOLD,
          fraudWindowHours: (dataToUpdate.fraudWindowHours as number) ?? DEFAULT_FRAUD_WINDOW_HOURS,
          platformCollectionIban: dataToUpdate.platformCollectionIban as string | undefined,
          platformAccountHolderName: dataToUpdate.platformAccountHolderName as string | undefined,
          platformBankName: dataToUpdate.platformBankName as string | undefined,
          updatedByAdminId: admin.id,
        },
        update: dataToUpdate,
        include: {
          updatedByAdmin: {
            select: { fullName: true },
          },
        },
      });

      // Immutable audit log row
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          actorType: 'ADMIN',
          action: PLATFORM_SETTINGS_UPDATED,
          entityType: 'PLATFORM_SETTING',
          entityId: 'default',
          payload: {
            actorName: admin.fullName,
            justificationReason: input.justificationReason.trim(),
            changedKeys,
            previousValues,
            newValues,
          },
          ipAddress: ipAddress ?? null,
        },
      });

      return upserted;
    });

    const resultDto = this.mapToDto(updatedRecord);

    // Refresh cache immediately
    this.cachedSettings = resultDto;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;

    return resultDto;
  }

  /**
   * Retrieves chronological audit trail of platform settings alterations.
   */
  async getAuditHistory(): Promise<PlatformSettingsAuditEntryDto[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'PLATFORM_SETTING',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return logs.map((log) => {
      const payload: any = log.payload || {};
      return {
        id: log.id,
        actorId: log.actorId,
        actorName: payload.actorName ?? undefined,
        action: log.action,
        timestamp: log.createdAt.toISOString(),
        justificationReason: payload.justificationReason ?? '',
        ipAddress: log.ipAddress,
        previousValues: payload.previousValues ?? {},
        newValues: payload.newValues ?? {},
        changedKeys: payload.changedKeys ?? [],
      };
    });
  }
}
