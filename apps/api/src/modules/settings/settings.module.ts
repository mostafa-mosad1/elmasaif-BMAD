import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformSettingsService } from './platform-settings.service';
import { PublicSettingsController } from './public-settings.controller';
import { AdminSettingsController } from './admin-settings.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PublicSettingsController, AdminSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class SettingsModule {}
