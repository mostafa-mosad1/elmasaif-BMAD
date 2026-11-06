import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { AuthModule } from '../auth/auth.module';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { AdminDealsController } from './admin-deals.controller';
import { DealsService } from './deals.service';

/**
 * Story 5.1: the deal binding module.
 *
 * `OffersModule` is deliberately **not** imported. Its `exports` carry a stale comment claiming
 * this story injects `BackupOffersService` to close the reserve queue, but closing backups belongs
 * to Story 5.4 (trap T-6) — importing it here would only invite the mistake. The one thing this
 * module needs from the offers module is `offer-lock.ts`, which is a plain function, not a provider.
 */
@Module({
  imports: [PrismaModule, ClockModule, AuthModule, CryptoModule],
  controllers: [AdminDealsController],
  providers: [DealsService, AdminSessionAuthGuard, AdminPermissionGuard],
  exports: [DealsService],
})
export class DealsModule {}
