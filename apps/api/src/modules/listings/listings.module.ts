import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { AdminListingsController } from './admin-listings.controller';
import { AdminListingsService } from './admin-listings.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';

@Module({
  imports: [PrismaModule, ClockModule, StorageModule, AuthModule],
  controllers: [ListingsController, AdminListingsController],
  providers: [
    ListingsService,
    AdminListingsService,
    SessionAuthGuard,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
    ActiveRoleGuard,
  ],
  exports: [ListingsService, AdminListingsService],
})
export class ListingsModule {}

