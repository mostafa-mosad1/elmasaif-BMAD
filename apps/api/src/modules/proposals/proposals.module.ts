import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';
import { ProposalsController } from './proposals.controller';
import { AdminProposalsController } from './admin-proposals.controller';
import { ProposalsService } from './proposals.service';
import { AdminProposalsService } from './admin-proposals.service';
import { ProposalMatcherService } from './proposal-matcher.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ActiveRoleGuard } from '../users/guards/active-role.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';

@Module({
  imports: [PrismaModule, ClockModule, AuthModule],
  controllers: [ProposalsController, AdminProposalsController],
  providers: [
    ProposalsService,
    ProposalMatcherService,
    AdminProposalsService,
    SessionAuthGuard,
    ActiveRoleGuard,
    AdminSessionAuthGuard,
    AdminPermissionGuard,
  ],
  exports: [ProposalMatcherService, ProposalsService],
})
export class ProposalsModule {}
