import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env']
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100
    }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule
  ]
})
export class AppModule {}
