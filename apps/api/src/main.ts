import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global exception filter enforcing standard error envelope (AD-8)
  app.useGlobalFilters(new HttpExceptionFilter());

  // Security headers
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // CORS
  const allowedOrigins = [
    process.env.WEB_URL || 'http://localhost:3000',
    'http://localhost:3000'
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('El Masaif API')
    .setDescription('Institutional Real Estate Marketplace Platform API (KSA)')
    .setVersion('1.0')
    .addTag('Listings', 'Property sales and listings')
    .addTag('Offers', 'Mediated offer and counter-offer negotiation')
    .addTag('Deals', 'Deal pipeline and dual wire transfer verification')
    .addTag('Admin', 'Moderation, Fal licensing, and compliance queues')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[El Masaif API] Server running at http://localhost:${port}/api/v1`);
  console.log(`[El Masaif API] Swagger docs at http://localhost:${port}/api/docs`);
}

// Bootstrap NestJS application
bootstrap();
