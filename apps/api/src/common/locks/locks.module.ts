import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../clock/clock.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { TaskClaimLockService } from './task-claim-lock.service';
import { AdminQueuesController } from './admin-queues.controller';

@Global()
@Module({
  imports: [PrismaModule, ClockModule, AuthModule],
  controllers: [AdminQueuesController],
  providers: [TaskClaimLockService],
  exports: [TaskClaimLockService],
})
export class LocksModule {}
