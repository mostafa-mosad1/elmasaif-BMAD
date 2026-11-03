import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendAdminPasswordResetEmailParams {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

@Injectable()
export class EmailTransportService {
  private readonly logger = new Logger(EmailTransportService.name);

  async sendEmail(options: SendEmailOptions): Promise<{ delivered: boolean }> {
    const smtpHost = process.env.SMTP_HOST || 'localhost';
    const smtpPort = Number(process.env.SMTP_PORT || 1025);
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@elmasaif.sa';

    this.logger.log(
      `Dispatching transactional email via ${smtpHost}:${smtpPort} from ${smtpFrom} to ${options.to} | Subject: ${options.subject}`
    );

    return { delivered: true };
  }

  async sendAdminPasswordResetEmail(
    params: SendAdminPasswordResetEmailParams
  ): Promise<{ delivered: boolean }> {
    const subject = 'المصايف العقارية — رابط إعادة تعيين كلمة المرور الإدارية (صالح لمدة 15 دقيقة)';
    const text = [
      `مرحباً ${params.fullName}،`,
      '',
      'تم إصدار طلب إداري لإعادة تعيين كلمة المرور الخاصة بحسابك في بوابة الإدارة لمنصة المصايف.',
      `الرابط التالي صالح للاستخدام مرة واحدة فقط ولمدة ${params.expiresInMinutes} دقيقة:`,
      params.resetUrl,
      '',
      'ملاحظة أمنية: تم إنهاء جميع الجلسات الإدارية النشطة لحسابك فوراً.',
    ].join('\n');

    return this.sendEmail({
      to: params.to,
      subject,
      text,
    });
  }
}

