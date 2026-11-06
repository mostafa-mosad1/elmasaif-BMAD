import {
  Injectable,
  Logger,
  ConflictException,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { OtpService } from '../auth/otp/otp.service';
import {
  ProfileStatus,
  ACTIVE_DEAL_STATUSES,
  ListingStatus,
  OwnerContractStatus,
  AUTH_DELETION_INITIATED,
  AUTH_DELETION_ACTIVE_DEAL_BLOCK,
  AUTH_DELETION_OPEN_DISPUTE_BLOCK,
  AUTH_DELETION_ACTIVE_CONTRACT_BLOCK,
  AUTH_DELETION_COOLING_OFF,
  AUTH_ACCOUNT_DEACTIVATED_STATUTORY,
  AUTH_DELETION_CANCELLED,
  AUTH_DELETION_TOKEN_INVALID,
  AUTH_DELETION_TOKEN_EXPIRED,
  AUTH_INVALID_CREDENTIALS,
  DELETION_COOLING_OFF_DAYS,
  DELETION_TOKEN_EXPIRY_SECONDS,
  InitiateAccountDeletionInput,
  ConfirmAccountDeletionInput,
  AccountDeletionEligibilityResponse,
  InitiateAccountDeletionResponse,
  ConfirmAccountDeletionResponse,
  CancelAccountDeletionResponse
} from '@elmasaif/shared';

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly otpService: OtpService
  ) {}

  private getSecret(): string {
    return (
      process.env.SESSION_SECRET ||
      'super-secret-session-key-for-elmasaif-2026-development'
    );
  }

  private maskSaudiMobile(phone: string): string {
    const clean = phone.replace(/[\s-]/g, '');
    const last4 = clean.slice(-4);
    return `+966 5X XXX ${last4}`;
  }

  private generateDeletionToken(userId: string): string {
    const exp =
      this.clockService.now().getTime() +
      DELETION_TOKEN_EXPIRY_SECONDS * 1000;
    const payload = { userId, exp };
    const secret = this.getSecret();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return Buffer.from(JSON.stringify({ payload, signature })).toString(
      'base64url'
    );
  }

  verifyDeletionToken(token: string): { userId: string; exp: number } {
    try {
      const raw = Buffer.from(token, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw);
      const { payload, signature } = parsed;
      const secret = this.getSecret();
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (
        !crypto.timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expectedSignature, 'hex')
        )
      ) {
        throw new HttpException(
          {
            code: AUTH_DELETION_TOKEN_INVALID,
            message: 'رمز التحقق لحذف الحساب غير صالح أو تم التلاعب به'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const expMs = payload.exp > 1e11 ? payload.exp : payload.exp * 1000;
      if (this.clockService.now().getTime() > expMs) {
        throw new HttpException(
          {
            code: AUTH_DELETION_TOKEN_EXPIRED,
            message: 'انتهت صلاحية رمز التحقق لحذف الحساب، يرجى إعادة الطلب'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return payload;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        {
          code: AUTH_DELETION_TOKEN_INVALID,
          message: 'رمز التحقق لحذف الحساب غير صالح أو تالف'
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async assertEligibility(
    userId: string,
    recordAudit = true,
    ip?: string
  ): Promise<string[]> {
    const userProfiles = await this.prisma.userProfile.findMany({
      where: { userId },
      select: { id: true }
    });
    const profileIds = userProfiles.map((p: any) => p.id);

    // 1. Active Deals Check
    if (profileIds.length > 0) {
      const activeDeal = await this.prisma.deal.findFirst({
        where: {
          AND: [
            {
              OR: [
                { buyerProfileId: { in: profileIds } },
                { sellerProfileId: { in: profileIds } }
              ]
            },
            {
              status: { in: [...ACTIVE_DEAL_STATUSES] as any },
            }
          ]
        }
      });

      if (activeDeal) {
        if (recordAudit) {
          await this.prisma.auditLog.create({
            data: {
              actorId: userId,
              actorType: 'USER',
              action: 'ACCOUNT_DELETION_BLOCKED',
              entityType: 'User',
              entityId: userId,
              ipAddress: ip || '127.0.0.1',
              payload: {
                reason: AUTH_DELETION_ACTIVE_DEAL_BLOCK,
                dealId: activeDeal.id
              }
            }
          });
        }
        throw new ConflictException({
          code: AUTH_DELETION_ACTIVE_DEAL_BLOCK,
          message:
            'لا يمكن حذف أو تعطيل الحساب لوجود صفقات عقارية جارية غير مكتملة'
        });
      }
    }

    // 2. Open Disputes Check
    const openDispute = await this.prisma.dispute.findFirst({
      where: {
        status: 'OPEN',
        OR: [
          { initiatorId: userId },
          ...(profileIds.length > 0
            ? [
                {
                  deal: {
                    OR: [
                      { buyerProfileId: { in: profileIds } },
                      { sellerProfileId: { in: profileIds } }
                    ]
                  }
                }
              ]
            : [])
        ]
      }
    });

    if (openDispute) {
      if (recordAudit) {
        await this.prisma.auditLog.create({
          data: {
            actorId: userId,
            actorType: 'USER',
            action: 'ACCOUNT_DELETION_BLOCKED',
            entityType: 'User',
            entityId: userId,
            ipAddress: ip || '127.0.0.1',
            payload: {
              reason: AUTH_DELETION_OPEN_DISPUTE_BLOCK,
              disputeId: openDispute.id
            }
          }
        });
      }
      throw new ConflictException({
        code: AUTH_DELETION_OPEN_DISPUTE_BLOCK,
        message: 'لا يمكن حذف أو تعطيل الحساب لوجود نزاعات مفتوحة قيد التحقيق'
      });
    }

    // 3. Pending Owner Listing Contracts Check
    if (profileIds.length > 0) {
      const pendingListingRequest =
        await this.prisma.ownerListingRequest.findFirst({
          where: {
            ownerProfileId: { in: profileIds },
            status: 'PENDING'
          }
        });

      const pendingOwnerContract = await this.prisma.ownerContract.findFirst({
        where: {
          ownerProfileId: { in: profileIds },
          OR: [
            { status: OwnerContractStatus.PENDING_FEE },
            { feePayments: { some: { status: 'PENDING' } } }
          ]
        }
      });

      if (pendingListingRequest || pendingOwnerContract) {
        if (recordAudit) {
          await this.prisma.auditLog.create({
            data: {
              actorId: userId,
              actorType: 'USER',
              action: 'ACCOUNT_DELETION_BLOCKED',
              entityType: 'User',
              entityId: userId,
              ipAddress: ip || '127.0.0.1',
              payload: {
                reason: AUTH_DELETION_ACTIVE_CONTRACT_BLOCK,
                requestId: pendingListingRequest?.id,
                contractId: pendingOwnerContract?.id
              }
            }
          });
        }
        throw new ConflictException({
          code: AUTH_DELETION_ACTIVE_CONTRACT_BLOCK,
          message:
            'لا يمكن حذف أو تعطيل الحساب لوجود طلبات عقارية أو عقود وساطة معلقة الرسوم'
        });
      }
    }

    return profileIds;
  }

  async countUserTransactionHistory(
    userId: string,
    profileIds?: string[]
  ): Promise<number> {
    if (!profileIds) {
      const userProfiles = await this.prisma.userProfile.findMany({
        where: { userId },
        select: { id: true }
      });
      profileIds = userProfiles.map((p: any) => p.id);
    }

    if (profileIds.length === 0) {
      const ratingCount = await this.prisma.rating.count({
        where: { OR: [{ raterUserId: userId }, { targetUserId: userId }] }
      });
      const disputeCount = await this.prisma.dispute.count({
        where: { initiatorId: userId }
      });
      return ratingCount + disputeCount;
    }

    const [
      listingsCount,
      offersCount,
      dealsCount,
      paymentsCount,
      contractsCount,
      conversationsCount,
      ratingsCount,
      disputesCount,
      demandsCount
    ] = await Promise.all([
      this.prisma.listing.count({
        where: { sellerProfileId: { in: profileIds } }
      }),
      this.prisma.offer.count({
        where: {
          OR: [
            { buyerProfileId: { in: profileIds } },
            { listing: { sellerProfileId: { in: profileIds } } }
          ]
        }
      }),
      this.prisma.deal.count({
        where: {
          OR: [
            { buyerProfileId: { in: profileIds } },
            { sellerProfileId: { in: profileIds } }
          ]
        }
      }),
      this.prisma.payment.count({
        where: {
          deal: {
            OR: [
              { buyerProfileId: { in: profileIds } },
              { sellerProfileId: { in: profileIds } }
            ]
          }
        }
      }),
      this.prisma.ownerContract.count({
        where: { ownerProfileId: { in: profileIds } }
      }),
      this.prisma.conversation.count({
        where: {
          OR: [
            { buyerProfileId: { in: profileIds } },
            { sellerProfileId: { in: profileIds } }
          ]
        }
      }),
      this.prisma.rating.count({
        where: { OR: [{ raterUserId: userId }, { targetUserId: userId }] }
      }),
      this.prisma.dispute.count({
        where: {
          OR: [
            { initiatorId: userId },
            {
              deal: {
                OR: [
                  { buyerProfileId: { in: profileIds } },
                  { sellerProfileId: { in: profileIds } }
                ]
              }
            }
          ]
        }
      }),
      this.prisma.demand.count({
        where: { buyerProfileId: { in: profileIds } }
      })
    ]);

    return (
      listingsCount +
      offersCount +
      dealsCount +
      paymentsCount +
      contractsCount +
      conversationsCount +
      ratingsCount +
      disputesCount +
      demandsCount
    );
  }

  async getEligibility(
    userId: string,
    ip?: string
  ): Promise<AccountDeletionEligibilityResponse> {
    const profileIds = await this.assertEligibility(userId, false, ip);
    const historyCount = await this.countUserTransactionHistory(
      userId,
      profileIds
    );
    const hasTransactionHistory = historyCount > 0;
    const mode = hasTransactionHistory ? 'STATUTORY_RETENTION' : 'COOLING_OFF';

    return {
      code: 'AUTH_DELETION_ELIGIBLE',
      message: hasTransactionHistory
        ? 'الحساب مؤهل لطلب الحذف مع الاحتفاظ بالسجلات المالية والتعاقدية نظامياً'
        : 'حسابك مؤهل لطلب الحذف مع مهلة نظامية مدتها 14 يوماً',
      data: {
        eligible: true,
        hasTransactionHistory,
        mode,
        coolingOffDays: hasTransactionHistory ? 0 : DELETION_COOLING_OFF_DAYS,
        message: hasTransactionHistory
          ? 'سيتم تعطيل الحساب والاحتفاظ بالسجلات المالية والتعاقدية نظامياً (BR-18)'
          : 'حسابك مؤهل لطلب الحذف مع مهلة نظامية مدتها 14 يوماً'
      }
    };
  }

  async initiateDeletion(
    userId: string,
    dto: InitiateAccountDeletionInput,
    ip?: string
  ): Promise<InitiateAccountDeletionResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpException(
        { code: AUTH_INVALID_CREDENTIALS, message: 'المستخدم غير موجود' },
        HttpStatus.UNAUTHORIZED
      );
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword
    );
    if (!isPasswordValid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } }
      });
      throw new HttpException(
        { code: AUTH_INVALID_CREDENTIALS, message: 'كلمة المرور غير صحيحة' },
        HttpStatus.UNAUTHORIZED
      );
    }

    // Verify blocking conditions
    await this.assertEligibility(user.id, true, ip);

    // Dispatch OTP
    const otpResult = await this.otpService.generateAndSendOtp(
      user.mobileNumber,
      'ACCOUNT_DELETION'
    );

    const deletionToken = this.generateDeletionToken(user.id);
    const maskedMobileNumber = this.maskSaudiMobile(user.mobileNumber);

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorType: 'USER',
        action: 'ACCOUNT_DELETION_INITIATED',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip || '127.0.0.1',
        payload: {
          mobileNumber: maskedMobileNumber,
          tokenExpiresInSeconds: DELETION_TOKEN_EXPIRY_SECONDS
        }
      }
    });

    return {
      code: AUTH_DELETION_INITIATED,
      message:
        'تم إرسال رمز التحقق إلى رقم جوالك المسجل لتأكيد حذف الحساب',
      data: {
        deletionToken,
        resendAvailableInSeconds: otpResult.resendAvailableInSeconds || 60,
        maskedMobileNumber
      }
    };
  }

  async confirmDeletion(
    userId: string,
    dto: ConfirmAccountDeletionInput,
    ip?: string
  ): Promise<ConfirmAccountDeletionResponse> {
    const payload = this.verifyDeletionToken(dto.deletionToken);
    if (payload.userId !== userId) {
      throw new HttpException(
        {
          code: AUTH_DELETION_TOKEN_INVALID,
          message: 'رمز التحقق لحذف الحساب لا يطابق المستخدم الحالي'
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpException(
        { code: AUTH_INVALID_CREDENTIALS, message: 'المستخدم غير موجود' },
        HttpStatus.UNAUTHORIZED
      );
    }

    // Verify OTP
    const otpRecord = await this.otpService.verifyOtp(
      user.mobileNumber,
      'ACCOUNT_DELETION',
      dto.code
    );
    await this.otpService.cleanupOtp(otpRecord.id);

    // Re-verify blocking conditions
    const profileIds = await this.assertEligibility(userId, true, ip);

    // Check transaction history count
    const historyCount = await this.countUserTransactionHistory(
      userId,
      profileIds
    );

    if (historyCount === 0) {
      // Branch A: Zero Transaction History -> 14-day cooling-off
      const now = this.clockService.now();
      const deletionDueAt = new Date(
        now.getTime() + DELETION_COOLING_OFF_DAYS * 24 * 60 * 60 * 1000
      );

      await this.prisma.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            status: ProfileStatus.DELETION_PENDING,
            deletionRequestedAt: now,
            deletionDueAt
          }
        });

        await tx.session.deleteMany({
          where: { userId: user.id }
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorType: 'USER',
            action: 'ACCOUNT_DELETION_REQUESTED',
            entityType: 'User',
            entityId: user.id,
            ipAddress: ip || '127.0.0.1',
            payload: {
              status: 'DELETION_PENDING',
              coolingOffDays: DELETION_COOLING_OFF_DAYS,
              deletionDueAt: deletionDueAt.toISOString()
            }
          }
        });
      });

      return {
        code: AUTH_DELETION_COOLING_OFF,
        message:
          'تمت جدولة حذف الحساب بنجاح. دخل الحساب في فترة مهلة نظامية مدتها 14 يوماً. يمكنك إلغاء طلب الحذف في أي وقت بمجرد تسجيل الدخول مجدداً خلال هذه الفترة',
        data: {
          status: ProfileStatus.DELETION_PENDING,
          deletionRequestedAt: now.toISOString(),
          deletionDueAt: deletionDueAt.toISOString(),
          coolingOffDays: DELETION_COOLING_OFF_DAYS
        }
      };
    } else {
      // Branch B: Historical Records -> Institutional Deactivation (BR-18)
      const now = this.clockService.now();

      await this.prisma.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            status: ProfileStatus.DEACTIVATED,
            deletionRequestedAt: now,
            deletionDueAt: null
          }
        });

        await tx.userProfile.updateMany({
          where: { userId: user.id },
          data: { status: ProfileStatus.DEACTIVATED }
        });

        if (profileIds.length > 0) {
          await tx.listing.updateMany({
            where: {
              sellerProfileId: { in: profileIds },
              status: {
                in: [
                  ListingStatus.ACTIVE,
                  ListingStatus.PENDING_REVIEW,
                  ListingStatus.PENDING_FEE
                ]
              }
            },
            data: { status: ListingStatus.REJECTED }
          });
        }

        await tx.session.deleteMany({
          where: { userId: user.id }
        });

        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorType: 'USER',
            action: 'ACCOUNT_DEACTIVATED_STATUTORY_RETENTION',
            entityType: 'User',
            entityId: user.id,
            ipAddress: ip || '127.0.0.1',
            payload: {
              status: 'DEACTIVATED',
              transactionHistoryDetected: true,
              statutoryRetentionRule: 'BR-18',
              commercialLawRetention: true
            }
          }
        });
      });

      return {
        code: AUTH_ACCOUNT_DEACTIVATED_STATUTORY,
        message:
          'تم تعطيل الحساب وإخفاء ملفك الشخصي بنجاح. نظراً لوجود تعاملات تجارية ومالية سابقة، سيتم الاحتفاظ بالسجلات التعاقدية والمالية وفقاً للمدد المقررة في الأنظمة التجارية والضريبية السعودية (BR-18)',
        data: {
          status: ProfileStatus.DEACTIVATED,
          deletionRequestedAt: now.toISOString(),
          retainedRecords: true
        }
      };
    }
  }

  async cancelDeletion(
    userId: string,
    ip?: string
  ): Promise<CancelAccountDeletionResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpException(
        { code: AUTH_INVALID_CREDENTIALS, message: 'المستخدم غير موجود' },
        HttpStatus.UNAUTHORIZED
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: ProfileStatus.ACTIVE,
        deletionRequestedAt: null,
        deletionDueAt: null
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorType: 'USER',
        action: 'ACCOUNT_DELETION_CANCELLED',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ip || '127.0.0.1',
        payload: {
          reason: 'User explicitly cancelled account deletion',
          restoredStatus: 'ACTIVE'
        }
      }
    });

    return {
      code: AUTH_DELETION_CANCELLED,
      message: 'تم إلغاء طلب حذف الحساب واستعادة نشاط الحساب بنجاح'
    };
  }
}

