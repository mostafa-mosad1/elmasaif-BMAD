import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../clock/clock.service';

@Injectable()
export class StartupGuardService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupGuardService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly clockService: ClockService
  ) {}

  onApplicationBootstrap(): void {
    this.assertProductionSafety();
  }

  assertProductionSafety(): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;

    if (nodeEnv === 'production') {
      const enableMockClock = this.configService.get<string>('ENABLE_MOCK_CLOCK') || process.env.ENABLE_MOCK_CLOCK;
      if (enableMockClock === 'true' || this.clockService.isMocked()) {
        const errorMsg = '[FATAL STARTUP GUARD] Mock clock and time manipulation are strictly forbidden in production (NODE_ENV=production). Aborting startup.';
        this.logger.error(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      const otpProvider = this.configService.get<string>('OTP_PROVIDER') || process.env.OTP_PROVIDER;
      const enableStaticOtp = this.configService.get<string>('ENABLE_STATIC_OTP') || process.env.ENABLE_STATIC_OTP;
      if (otpProvider === 'static' || enableStaticOtp === 'true') {
        const errorMsg = "[FATAL STARTUP GUARD] Static OTP provider ('123456') is strictly forbidden in production (NODE_ENV=production). Aborting startup.";
        this.logger.error(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      const jwtSecret = this.configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
      const sessionSecret = this.configService.get<string>('SESSION_SECRET') || process.env.SESSION_SECRET;
      if (
        jwtSecret === 'dev-secret' ||
        jwtSecret === 'change-me' ||
        sessionSecret === 'dev-session-secret' ||
        sessionSecret === 'change-me'
      ) {
        const errorMsg = '[FATAL STARTUP GUARD] Insecure development secrets detected in production. Aborting startup.';
        this.logger.error(errorMsg);
        console.error(errorMsg);
        process.exit(1);
      }

      this.logger.log('[StartupGuard] Production safety checks passed successfully.');
    } else {
      this.logger.warn(
        `[StartupGuard] Running in development/testing mode (NODE_ENV=${nodeEnv || 'development'}). Virtual time shifting and dev OTP testing are permitted.`
      );
    }
  }
}
