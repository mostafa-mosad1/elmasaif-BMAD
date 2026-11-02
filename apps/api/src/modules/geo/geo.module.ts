import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { GeoController } from './geo.controller';
import { AdminGeoController, AdminGeoGuard } from './admin-geo.controller';
import { GeoService } from './geo.service';
import { AdminSessionAuthGuard } from '../auth/guards/admin-session-auth.guard';

@Module({
  imports: [PrismaModule, ClockModule],
  controllers: [GeoController, AdminGeoController],
  providers: [GeoService, AdminSessionAuthGuard, AdminGeoGuard],
  exports: [GeoService]
})
export class GeoModule {}
