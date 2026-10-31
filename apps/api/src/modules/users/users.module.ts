import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ActiveRoleGuard } from './guards/active-role.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { IdentityController } from './identity.controller';
import { AdminIdentityController, AdminIdentityGuard } from './admin-identity.controller';
import { IdentityService } from './identity.service';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';

@Module({
  imports: [StorageModule, AuthModule, CryptoModule],
  controllers: [UsersController, IdentityController, AdminIdentityController, PayoutController],
  providers: [
    UsersService,
    ActiveRoleGuard,
    SessionAuthGuard,
    AdminSessionAuthGuard,
    AdminIdentityGuard,
    IdentityService,
    PayoutService
  ],
  exports: [UsersService, ActiveRoleGuard, IdentityService, PayoutService]
})
export class UsersModule {}
