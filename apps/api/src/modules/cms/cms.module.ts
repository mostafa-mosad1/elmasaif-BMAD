import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { CmsService } from './cms.service';
import { CmsController } from './cms.controller';
import { AdminCmsController } from './admin-cms.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [CmsController, AdminCmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule implements OnModuleInit {
  constructor(private readonly cmsService: CmsService) {}

  async onModuleInit() {
    try {
      await this.cmsService.seedDefaultCmsData();
    } catch {
      // Ignore during initial testing or db offline
    }
  }
}

