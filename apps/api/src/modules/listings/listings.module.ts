import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';

@Module({
  imports: [PrismaModule, ClockModule, StorageModule, AuthModule],
  controllers: [ListingsController],
  providers: [ListingsService, SessionAuthGuard, ActiveRoleGuard],
  exports: [ListingsService],
})
export class ListingsModule {}

