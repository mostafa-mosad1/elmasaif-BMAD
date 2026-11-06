import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';

@Module({
  imports: [PrismaModule, ClockModule, AuthModule],
  controllers: [OffersController],
  providers: [OffersService, SessionAuthGuard, ActiveRoleGuard],
  exports: [OffersService],
})
export class OffersModule {}
