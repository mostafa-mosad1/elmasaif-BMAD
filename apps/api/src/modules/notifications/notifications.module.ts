import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationAuthGuard } from './guards/notification-auth.guard';

@Global()
@Module({
  imports: [PrismaModule, ClockModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationAuthGuard],
  exports: [NotificationsService, NotificationAuthGuard],
})
export class NotificationsModule {}
