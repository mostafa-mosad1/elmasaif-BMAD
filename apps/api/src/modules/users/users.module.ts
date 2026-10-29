import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ActiveRoleGuard } from './guards/active-role.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { StorageModule } from '../storage/storage.module';
import { IdentityController } from './identity.controller';
import { AdminIdentityController, AdminIdentityGuard } from './admin-identity.controller';
import { IdentityService } from './identity.service';

@Module({
  imports: [StorageModule],
  controllers: [UsersController, IdentityController, AdminIdentityController],
  providers: [
    UsersService,
    ActiveRoleGuard,
    SessionAuthGuard,
    AdminSessionAuthGuard,
    AdminIdentityGuard,
    IdentityService
  ],
  exports: [UsersService, ActiveRoleGuard, IdentityService]
})
export class UsersModule {}
