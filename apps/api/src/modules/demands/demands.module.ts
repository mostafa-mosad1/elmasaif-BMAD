import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';
import { DemandsController } from './demands.controller';
import { DemandsService } from './demands.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';

@Module({
  imports: [PrismaModule, ClockModule, AuthModule],
  controllers: [DemandsController],
  providers: [DemandsService, SessionAuthGuard, ActiveRoleGuard],
  exports: [DemandsService],
})
export class DemandsModule {}
