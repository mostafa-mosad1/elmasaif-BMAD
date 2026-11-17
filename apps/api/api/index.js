const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { ValidationPipe } = require('@nestjs/common');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

let server;

async function bootstrap() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);

  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return expressApp;
}

module.exports = async (req, res) => {
  if (!server) {
    server = await bootstrap();
  }
  return server(req, res);
};

