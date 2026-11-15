import { Module, forwardRef } from '@nestjs/common';
import { ExecutiveService } from './executive.service';
import { ExecutiveController } from './executive.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../../common/clock/clock.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    ClockModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [ExecutiveController],
  providers: [ExecutiveService],
  exports: [ExecutiveService],
})
export class ExecutiveModule {}

