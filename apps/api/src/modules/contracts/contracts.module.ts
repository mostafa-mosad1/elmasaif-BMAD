import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { ContractTemplatesService } from './contract-templates.service';
import { OwnerRequestsService } from './owner-requests.service';
import { AdminOwnerRequestsService } from './admin-owner-requests.service';
import { OwnerRequestsController } from './owner-requests.controller';
import { AdminOwnerRequestsController } from './admin-owner-requests.controller';
import { AdminContractTemplatesController } from './admin-contract-templates.controller';

@Module({
  imports: [PrismaModule, ClockModule, StorageModule, AuthModule],
  controllers: [
    OwnerRequestsController,
    AdminOwnerRequestsController,
    AdminContractTemplatesController,
  ],
  providers: [
    ContractTemplatesService,
    OwnerRequestsService,
    AdminOwnerRequestsService,
  ],
  exports: [
    ContractTemplatesService,
    OwnerRequestsService,
    AdminOwnerRequestsService,
  ],
})
export class ContractsModule {}

