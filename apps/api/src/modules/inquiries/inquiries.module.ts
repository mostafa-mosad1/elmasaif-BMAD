import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { InquiriesController } from './inquiries.controller';
import { AdminInquiriesController } from './admin-inquiries.controller';
import { InquiriesService } from './inquiries.service';
import { AdminInquiriesService } from './admin-inquiries.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';

@Module({
  imports: [PrismaModule, ClockModule, AuthModule, StorageModule],
  controllers: [InquiriesController, AdminInquiriesController],
  providers: [
    InquiriesService,
    AdminInquiriesService,
    SessionAuthGuard,
    ActiveRoleGuard,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
  ],
  exports: [InquiriesService, AdminInquiriesService],
})
export class InquiriesModule {}
