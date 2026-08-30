import { DEFAULT_API_PORT, parsePort } from '@tarzan/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = parsePort(process.env.PORT, DEFAULT_API_PORT);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
