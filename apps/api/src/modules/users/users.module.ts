import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ActiveRoleGuard } from './guards/active-role.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { IdentityController } from './identity.controller';
import { AdminIdentityController, AdminIdentityGuard } from './admin-identity.controller';
import { IdentityService } from './identity.service';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';
import { PhoneChangeController } from './phone-change.controller';
import { AdminPhoneChangeController } from './admin-phone-change.controller';
import { PhoneChangeService } from './phone-change.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
import { BrokersController } from './brokers.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { BrokersService } from './brokers.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [StorageModule, AuthModule, CryptoModule],
  controllers: [
    UsersController,
    IdentityController,
    AdminIdentityController,
    PayoutController,
    PhoneChangeController,
    AdminPhoneChangeController,
    ProfileController,
    AccountDeletionController,
    PreferencesController,
    BrokersController,
    AdminReviewsController,
    AdminUsersController,
  ],
  providers: [
    UsersService,
    ActiveRoleGuard,
    SessionAuthGuard,
    AdminSessionAuthGuard,
    AdminIdentityGuard,
    AdminPermissionGuard,
    IdentityService,
    PayoutService,
    PhoneChangeService,
    ProfileService,
    AccountDeletionService,
    PreferencesService,
    BrokersService,
    AdminUsersService,
  ],
  exports: [
    UsersService,
    ActiveRoleGuard,
    IdentityService,
    PayoutService,
    PhoneChangeService,
    ProfileService,
    AccountDeletionService,
    PreferencesService,
    BrokersService,
    AdminUsersService,
  ]
})
export class UsersModule {}
