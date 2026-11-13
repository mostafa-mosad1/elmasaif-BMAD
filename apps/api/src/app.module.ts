import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { GeoModule } from './modules/geo/geo.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ListingsModule } from './modules/listings/listings.module';
import { DemandsModule } from './modules/demands/demands.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { OffersModule } from './modules/offers/offers.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { DealsModule } from './modules/deals/deals.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { SupportModule } from './modules/support/support.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ClockModule } from './common/clock/clock.module';
import { LocksModule } from './common/locks/locks.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env']
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100
    }]),
    ClockModule,
    PrismaModule,
    LocksModule,
    HealthModule,
    StorageModule,
    GeoModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    DemandsModule,
    ProposalsModule,
    OffersModule,
    InquiriesModule,
    DealsModule,
    LicensesModule,
    ContractsModule,
    SupportModule,
    SettingsModule,
    AuditModule,
    NotificationsModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
