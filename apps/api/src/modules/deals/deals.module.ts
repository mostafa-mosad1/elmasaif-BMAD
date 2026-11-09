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
import { AdminDisputesController } from './admin-disputes.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { BuyerDealsService } from './buyer-deals.service';
import { DealsService } from './deals.service';
import { DealCompletionService } from './deal-completion.service';
import { DealTimeoutService } from './deal-timeout.service';
import { PlatformAccountService } from './platform-account';
import { DealsCancellationService } from './deals-cancellation.service';
import { DisputesService } from './disputes.service';

/**
 * Story 5.1: the deal binding module.
 * Story 5.2: adds the buyer payment surface.
 * Story 5.4: imports OffersModule for BackupOffersService to close queued backup offers upon deal completion.
 * Story 5.6: adds cancellation and dispute adjudication back-office services and controllers.
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
  controllers: [
    AdminDealsController,
    AdminPaymentsController,
    BuyerDealsController,
    AdminDisputesController,
  ],
  providers: [
    DealsService,
    DealCompletionService,
    DealTimeoutService,
    AdminPaymentsService,
    BuyerDealsService,
    PlatformAccountService,
    DealsCancellationService,
    DisputesService,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
    SessionAuthGuard,
    ActiveRoleGuard,
  ],
  exports: [
    DealsService,
    DealCompletionService,
    DealTimeoutService,
    BuyerDealsService,
    DealsCancellationService,
    DisputesService,
  ],
})
export class DealsModule {}
