import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { AdminDealsController } from './admin-deals.controller';
import { BuyerDealsController } from './buyer-deals.controller';
import { BuyerDealsService } from './buyer-deals.service';
import { DealsService } from './deals.service';
import { PlatformAccountService } from './platform-account';

/**
 * Story 5.1: the deal binding module. Story 5.2 adds the buyer payment surface (D7 — buyer routes
 * live here rather than in a `payments` module, because the proof upload is part of the same deal
 * state machine).
 *
 * `OffersModule` is deliberately **not** imported. Its `exports` carry a stale comment claiming
 * this story injects `BackupOffersService` to close the reserve queue, but closing backups belongs
 * to Story 5.4 (trap T-6) — importing it here would only invite the mistake. The one thing this
 * module needs from the offers module is `offer-lock.ts`, which is a plain function, not a provider.
 *
 * `UsersModule` is imported for `IdentityService` and `ActiveRoleGuard` (the FR-30 identity gate).
 * There is no cycle: `UsersModule` does not import `DealsModule`.
 */
@Module({
  imports: [PrismaModule, ClockModule, AuthModule, CryptoModule, StorageModule, UsersModule],
  controllers: [AdminDealsController, BuyerDealsController],
  providers: [
    DealsService,
    BuyerDealsService,
    PlatformAccountService,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
    SessionAuthGuard,
    ActiveRoleGuard,
  ],
  exports: [DealsService, BuyerDealsService],
})
export class DealsModule {}
