import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MANDATORY_NOTIFICATION_EVENTS,
  NotificationCategory,
  NotificationChannel,
  NotificationDto,
  NotificationQueryInput,
  PaginatedNotificationsDto,
  SendNotificationInput,
  UnreadNotificationCountDto,
  NOTIFICATION_NOT_FOUND,
  NOTIFICATION_DEAL_CREATED,
  NOTIFICATION_DEAL_PAYMENT_DEADLINE_WARNING,
  NOTIFICATION_DEAL_PROOF_REJECTED,
  NOTIFICATION_DEAL_COMPLETED,
  NOTIFICATION_CONTRACT_READY_FOR_SIGNATURE,
  NOTIFICATION_FAL_EXPIRY_WARNING,
} from '@elmasaif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/clock/clock.service';
import { EmailTransportService } from '../auth/email/email-transport.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ClockService,
    private readonly emailTransportService: EmailTransportService,
  ) {}

  /**
   * Dispatch notification across specified channels (IN_APP, EMAIL, SMS).
   * Strictly enforces critical / mandatory notifications bypass user muting (A-09, FR-44).
   */
  async dispatch(
    input: SendNotificationInput,
  ): Promise<{ inAppNotificationId?: string; emailDispatched: boolean }> {
    const isCritical = Boolean(
      input.isCritical || MANDATORY_NOTIFICATION_EVENTS.includes(input.eventKey),
    );

    const channels =
      input.channels && input.channels.length > 0
        ? input.channels
        : [NotificationChannel.IN_APP];

    // Fetch user and preferences if available
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      include: { preferences: true },
    });

    const recipientEmail = input.recipientEmail || user?.email || undefined;
    const recipientName = input.recipientName || user?.fullName || 'مستخدم منصة المصايف';

    let inAppNotificationId: string | undefined;
    let emailDispatched = false;

    // 1. IN_APP Channel Delivery
    if (channels.includes(NotificationChannel.IN_APP)) {
      const created = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          eventKey: input.eventKey,
          channel: NotificationChannel.IN_APP,
          category: input.category || NotificationCategory.SYSTEM,
          title: input.title,
          message: input.message,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
          deepLink: input.deepLink || null,
          metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
          isCritical,
          isRead: false,
        },
      });
      inAppNotificationId = created.id;
    }

    // 2. EMAIL Channel Delivery
    if (channels.includes(NotificationChannel.EMAIL) || input.recipientEmail) {
      // Evaluate preferences: critical notifications bypass muting (A-09)
      const userAllowsEmail = user?.preferences ? user.preferences.emailNotifications : true;
      const canSendEmail = isCritical || userAllowsEmail;

      if (canSendEmail && recipientEmail) {
        const { subject, text, html } = this.formatEmailPayload(input, recipientName);
        try {
          await this.emailTransportService.sendEmail({
            to: recipientEmail,
            subject,
            text,
            html,
          });
          emailDispatched = true;
        } catch (err: any) {
          this.logger.error(
            `Failed to dispatch transactional email for event ${input.eventKey} to ${recipientEmail}: ${err?.message}`,
            err?.stack,
          );
        }
      } else {
        this.logger.debug(
          `Skipping email delivery for user ${input.userId} (allowed: ${canSendEmail}, email: ${recipientEmail})`,
        );
      }
    }

    return {
      inAppNotificationId,
      emailDispatched,
    };
  }

  /**
   * Get paginated notifications feed for an authenticated user with unread counts.
   */
  async getUserNotifications(
    userId: string,
    query: NotificationQueryInput,
  ): Promise<PaginatedNotificationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };

    if (query.unreadOnly) {
      where.isRead = false;
    }

    if (query.category) {
      where.category = query.category;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: items.map((item) => this.mapToDto(item)),
      total,
      unreadCount,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Fast count of unread notifications for lightweight badge polling.
   */
  async getUnreadCount(userId: string): Promise<UnreadNotificationCountDto> {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  /**
   * Mark a specific notification as read, validating user ownership.
   */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException({
        code: NOTIFICATION_NOT_FOUND,
        message: 'الإشعار المطلوب غير موجود أو غير تابع للمستخدم الحالي',
      });
    }

    if (notification.isRead) {
      return this.mapToDto(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: this.clockService.now(),
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Mark all unread notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<{ markedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: this.clockService.now(),
      },
    });

    return { markedCount: result.count };
  }

  /**
   * Map database model to shared NotificationDto.
   */
  private mapToDto(item: any): NotificationDto {
    return {
      id: item.id,
      userId: item.userId,
      eventKey: item.eventKey,
      channel: item.channel as NotificationChannel,
      category: item.category as NotificationCategory,
      title: item.title,
      message: item.message,
      entityType: item.entityType,
      entityId: item.entityId,
      deepLink: item.deepLink,
      metadata: (item.metadata as Record<string, unknown>) || null,
      isRead: item.isRead,
      readAt: item.readAt ? new Date(item.readAt).toISOString() : null,
      isCritical: item.isCritical,
      createdAt: new Date(item.createdAt).toISOString(),
    };
  }

  /**
   * Build branded, accessible Arabic transactional email content tailored to the event.
   */
  private formatEmailPayload(
    input: SendNotificationInput,
    recipientName: string,
  ): { subject: string; text: string; html: string } {
    const metadata = input.metadata || {};
    let subject = `المصايف — ${input.title}`;
    let bodyText = input.message;

    switch (input.eventKey) {
      case NOTIFICATION_DEAL_CREATED: {
        const dealRef = metadata.dealNumber || metadata.dealId || '';
        subject = `المصايف العقارية — تم إنشاء طلب الصفقة العقارية #${dealRef}`;
        bodyText = [
          `مرحباً ${recipientName}،`,
          '',
          `تم إنشاء طلب الصفقة العقارية #${dealRef} بنجاح.`,
          `قيمة الصفقة: ${metadata.dealPrice || '—'} ر.س`,
          `عمولة المنصة: ${metadata.commission || '—'} ر.س`,
          `الموعد النهائي للسداد: ${metadata.paymentDeadline || 'خلال 48 ساعة'}`,
          `آيبان المنصة للتحويل: ${metadata.platformIban || '—'}`,
          '',
          'يرجى سداد المبلغ ورفع إثبات التحويل البنكي قبل انتهاء المهلة المحددة لتفادي الإلغاء التلقائي.',
        ].join('\n');
        break;
      }

      case NOTIFICATION_DEAL_PAYMENT_DEADLINE_WARNING: {
        const remainingHours = metadata.remainingHours || 12;
        subject = `المصايف العقارية — تنبيه اقتراب انتهاء مهلة سداد الصفقة (متبقي ${remainingHours} ساعة)`;
        bodyText = [
          `مرحباً ${recipientName}،`,
          '',
          `نلفت عنايتكم إلى أنه تبقى ${remainingHours} ساعة فقط على انتهاء مهلة سداد الصفقة العقارية #${metadata.dealNumber || ''}.`,
          'في حال عدم إرفاق إيصال السداد المعتمد قبل انتهاء المهلة، سيتم إلغاء الصفقة تلقائياً وإعادة فتح العقار للمشترين الآخرين.',
        ].join('\n');
        break;
      }

      case NOTIFICATION_DEAL_PROOF_REJECTED: {
        subject = `المصايف العقارية — إشعار رفض إثبات سداد الصفقة #${metadata.dealNumber || ''}`;
        bodyText = [
          `مرحباً ${recipientName}،`,
          '',
          `تمت مراجعة إيصال السداد المرفوع للصفقة #${metadata.dealNumber || ''} ولم يتم قبوله للسبب التالي:`,
          `"${metadata.rejectionReason || input.message}"`,
          '',
          'لديك مهلة تصحيح مدتها 12 ساعة لرفع إثبات سداد صحيح قبل إلغاء الصفقة.',
        ].join('\n');
        break;
      }

      case NOTIFICATION_DEAL_COMPLETED: {
        subject = `المصايف العقارية — اكتمال الصفقة العقارية #${metadata.dealNumber || ''} بنجاح`;
        bodyText = [
          `تهانينا ${recipientName}،`,
          '',
          `تم اعتماد وتوثيق اكتمال الصفقة العقارية #${metadata.dealNumber || ''} بنجاح!`,
          'العقار جاهز الآن لنقل الملكية لدى الإفراغ العقاري والبورصة العقارية.',
          `بيانات الاتصال للبائع: ${metadata.sellerPhone || 'متوفرة في تفاصيل الصفقة'}.`,
        ].join('\n');
        break;
      }

      case NOTIFICATION_CONTRACT_READY_FOR_SIGNATURE: {
        subject = `المصايف العقارية — عقد تسويق عقاري جاهز للتوقيع الإلكتروني`;
        bodyText = [
          `مرحباً ${recipientName}،`,
          '',
          'تم إصدار عقد التسويق العقاري الإلكتروني لعقارك وهو جاهز للتوقيع المعتمد عبر رمز التحقق (OTP).',
          'يرجى الدخول إلى المنصة لإتمام التوقيع وبدء عرض وتسويق عقارك رسمياً.',
        ].join('\n');
        break;
      }

      case NOTIFICATION_FAL_EXPIRY_WARNING: {
        const days = metadata.daysRemaining || 30;
        subject = `المصايف العقارية — تنبيه اقتراب انتهاء رخصة فال العقارية (${days} يوم)`;
        bodyText = [
          `مرحباً ${recipientName}،`,
          '',
          `نود إشعاركم بأن رخصة فال العقارية المسجلة لحسابكم ستنتهي خلال ${days} يوماً.`,
          'يرجى تجديد الرخصة لدى الهيئة العامة للعقار وتحديث البيانات في المنصة لضمان استمرار صلاحيات التسويق والوساطة دون انقطاع.',
        ].join('\n');
        break;
      }

      default:
        break;
    }

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; direction: rtl; text-align: right; }
    .card { background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; max-width: 600px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: bold; color: #0f766e; }
    .title { font-size: 18px; font-weight: 600; margin: 16px 0 8px; color: #0f172a; }
    .content { font-size: 14px; line-height: 1.8; color: #334155; white-space: pre-line; }
    .button { display: inline-block; margin-top: 24px; padding: 12px 24px; background-color: #0f766e; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">منصة المصايف العقارية</div>
    </div>
    <div class="title">${input.title}</div>
    <div class="content">${bodyText}</div>
    ${
      input.deepLink
        ? `<div style="text-align: center;"><a href="${input.deepLink}" class="button">عرض التفاصيل في المنصة</a></div>`
        : ''
    }
    <div class="footer">
      هذا البريد الإلكتروني آلي من منصة المصايف العقارية المعتمدة من الهيئة العامة للعقار (رخصة فال).
    </div>
  </div>
</body>
</html>
    `.trim();

    return {
      subject,
      text: bodyText,
      html,
    };
  }
}

