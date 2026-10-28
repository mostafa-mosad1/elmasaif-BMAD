import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { QuarantineService } from './quarantine.service';
import { MalwareScannerService } from './malware-scanner.service';
import { StorageController } from './storage.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StorageController],
  providers: [StorageService, QuarantineService, MalwareScannerService],
  exports: [StorageService, QuarantineService, MalwareScannerService],
})
export class StorageModule {}

