import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ActiveRoleGuard } from './guards/active-role.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ActiveRoleGuard, SessionAuthGuard],
  exports: [UsersService, ActiveRoleGuard]
})
export class UsersModule {}
