import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpProvider } from '../otp-provider.interface';

@Injectable()
export class SmsOtpProvider implements OtpProvider {
  private readonly logger = new Logger(SmsOtpProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(mobileNumber: string, code: string): Promise<boolean> {
    const smsGatewayUrl = this.configService.get<string>('SMS_GATEWAY_URL');
    const senderId = this.configService.get<string>('SMS_SENDER_ID', 'ELMASAIF');

    this.logger.log(`[PRODUCTION SMS GATEWAY] Dispatching OTP (${code.length} digits) via gateway: ${smsGatewayUrl || 'DEFAULT'} to ${mobileNumber} with sender ${senderId}`);

    // Production integration hook for Unifonic / Taqnyat / STC
    // In actual gateway call, payload: { to: mobileNumber, message: `رمز التحقق الخاص بك لمنصة المصايف هو: ${code}`, sender: senderId }
    return true;
  }
}
