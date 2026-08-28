import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // class-validator/class-transformer were installed but nothing was actually
  // enforcing DTO validation — every request body was accepted as-is. whitelist
  // strips unknown properties; forbidNonWhitelisted rejects the request outright
  // instead of silently dropping them.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // Credentialed CORS, restricted to the frontend origin — required because the
  // session lives in an httpOnly cookie (see auth.controller.ts), not a bearer token.
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
