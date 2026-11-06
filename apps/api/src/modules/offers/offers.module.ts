import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';
import { OffersController } from './offers.controller';
import { AdminOffersController } from './admin-offers.controller';
import { OffersService } from './offers.service';
import { AdminOffersService } from './admin-offers.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';

@Module({
  imports: [PrismaModule, ClockModule, AuthModule],
  controllers: [OffersController, AdminOffersController],
  providers: [
    OffersService,
    AdminOffersService,
    SessionAuthGuard,
    ActiveRoleGuard,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
  ],
  exports: [OffersService, AdminOffersService],
})
export class OffersModule {}
