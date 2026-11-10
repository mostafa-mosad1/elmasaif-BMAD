import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';
import { AdminLicensesController } from './admin-licenses.controller';
import { AdminLicensesService } from './admin-licenses.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';

@Module({
  imports: [PrismaModule, ClockModule, StorageModule, AuthModule],
  controllers: [LicensesController, AdminLicensesController],
  providers: [
    LicensesService,
    AdminLicensesService,
    SessionAuthGuard,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
  ],
  exports: [LicensesService, AdminLicensesService],
})
export class LicensesModule {}

