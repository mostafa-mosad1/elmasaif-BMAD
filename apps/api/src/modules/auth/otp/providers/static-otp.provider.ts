import { Injectable, Logger } from '@nestjs/common';
import { OtpProvider } from '../otp-provider.interface';

@Injectable()
export class StaticOtpProvider implements OtpProvider {
  private readonly logger = new Logger(StaticOtpProvider.name);

  async sendOtp(mobileNumber: string, code: string): Promise<boolean> {
    this.logger.log(`[DEV OTP DISPATCH] Sent static verification code '${code}' to mobile ${mobileNumber}`);
    return true;
  }
}
