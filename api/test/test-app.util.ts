import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

// Mirrors src/main.ts's real bootstrap exactly, so e2e tests exercise the same
// behavior a real request actually hits, not a stripped-down app missing pieces
// of it. This exists because building it by hand per test file already caused a
// real bug to go undetected: no e2e test ever registered the global
// ValidationPipe, so every DTO's decorators (@IsEmail, etc.) were silently never
// enforced in any e2e test — one finally asserted a 400 for bad input and got a
// 409 instead, because the "invalid" row had actually been written to the
// database. Centralizing the bootstrap here means every current and future e2e
// test automatically stays in sync with main.ts instead of each file risking its
// own drift.
export async function createTestApp(options?: { rawBody?: boolean }): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication(
    options?.rawBody ? { rawBody: true } : undefined,
  );
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.init();

  return app;
}
