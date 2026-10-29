import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp/otp.service';
import { OTP_PROVIDER_TOKEN } from './otp/otp-provider.interface';
import { StaticOtpProvider } from './otp/providers/static-otp.provider';
import { SmsOtpProvider } from './otp/providers/sms-otp.provider';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';

@Module({
  imports: [PrismaModule, ClockModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SessionAuthGuard,
    StaticOtpProvider,
    SmsOtpProvider,
    {
      provide: OTP_PROVIDER_TOKEN,
      useFactory: (
        configService: ConfigService,
        staticProvider: StaticOtpProvider,
        smsProvider: SmsOtpProvider
      ) => {
        const isProd = configService.get<string>('NODE_ENV') === 'production';
        const otpProvider = configService.get<string>('OTP_PROVIDER', 'static');
        if (isProd || otpProvider === 'sms') {
          return smsProvider;
        }
        return staticProvider;
      },
      inject: [ConfigService, StaticOtpProvider, SmsOtpProvider]
    }
  ],
  exports: [AuthService, OtpService, SessionAuthGuard]
})
export class AuthModule {}

