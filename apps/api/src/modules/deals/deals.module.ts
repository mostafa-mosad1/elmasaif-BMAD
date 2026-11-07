import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { OffersModule } from '../offers/offers.module';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { AdminDealsController } from './admin-deals.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { BuyerDealsController } from './buyer-deals.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { BuyerDealsService } from './buyer-deals.service';
import { DealsService } from './deals.service';
import { DealCompletionService } from './deal-completion.service';
import { PlatformAccountService } from './platform-account';

/**
 * Story 5.1: the deal binding module.
 * Story 5.2: adds the buyer payment surface.
 * Story 5.4: imports OffersModule for BackupOffersService to close queued backup offers upon deal completion.
 */
@Module({
  imports: [
    PrismaModule,
    ClockModule,
    AuthModule,
    CryptoModule,
    StorageModule,
    UsersModule,
    OffersModule,
  ],
  controllers: [AdminDealsController, AdminPaymentsController, BuyerDealsController],
  providers: [
    DealsService,
    DealCompletionService,
    AdminPaymentsService,
    BuyerDealsService,
    PlatformAccountService,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
    SessionAuthGuard,
    ActiveRoleGuard,
  ],
  exports: [DealsService, DealCompletionService, BuyerDealsService],
})
export class DealsModule {}
