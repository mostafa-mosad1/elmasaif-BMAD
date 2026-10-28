import { Module, Global } from '@nestjs/common';
import { ClockService } from './clock.service';
import { ClockDevController } from './clock-dev.controller';
import { StartupGuardService } from '../guards/startup-guard.service';

@Global()
@Module({
  controllers: [ClockDevController],
  providers: [ClockService, StartupGuardService],
  exports: [ClockService, StartupGuardService]
})
export class ClockModule {}
