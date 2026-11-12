import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { StorageModule } from '../storage/storage.module';
import { ViolationReportsService } from './violation-reports.service';
import { ViolationReportsController } from './violation-reports.controller';
import { AdminViolationReportsController } from './admin-violation-reports.controller';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicketsController } from './support-tickets.controller';
import { AdminSupportTicketsController } from './admin-support-tickets.controller';

@Module({
  imports: [PrismaModule, ClockModule, StorageModule],
  controllers: [
    ViolationReportsController,
    AdminViolationReportsController,
    SupportTicketsController,
    AdminSupportTicketsController,
  ],
  providers: [ViolationReportsService, SupportTicketsService],
  exports: [ViolationReportsService, SupportTicketsService],
})
export class SupportModule {}

