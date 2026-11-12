import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditService } from './audit.service';
import { AdminAuditController } from './admin-audit.controller';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AdminAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

