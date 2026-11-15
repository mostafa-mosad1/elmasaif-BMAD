import { Module, forwardRef } from '@nestjs/common';
import { FraudService } from './fraud.service';
import { FraudController } from './fraud.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [FraudController],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}

