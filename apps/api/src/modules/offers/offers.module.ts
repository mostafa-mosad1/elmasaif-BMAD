import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';
import { OffersController } from './offers.controller';
import { AdminOffersController } from './admin-offers.controller';
import { AdminBackupOffersController } from './admin-backup-offers.controller';
import { OffersService } from './offers.service';
import { AdminOffersService } from './admin-offers.service';
import { BackupOffersService } from './backup-offers.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';

@Module({
  imports: [PrismaModule, ClockModule, AuthModule],
  controllers: [OffersController, AdminOffersController, AdminBackupOffersController],
  providers: [
    OffersService,
    AdminOffersService,
    BackupOffersService,
    SessionAuthGuard,
    ActiveRoleGuard,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
  ],
  // Story 5.1 injects `BackupOffersService` to close the remaining backups inside the
  // deal-completion transaction.
  exports: [OffersService, AdminOffersService, BackupOffersService],
})
export class OffersModule {}
