import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import type { Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true exposes req.rawBody (a Buffer) on every request, alongside the
  // normal parsed req.body — needed for Shopify webhook HMAC verification, which
  // must be computed over the exact raw bytes Shopify sent, not a re-serialized
  // JSON.stringify(req.body) (whitespace/key-order differences would break the
  // signature). Doesn't disable or change normal body parsing for any other route.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.use(cookieParser());

  // Serves staff-uploaded site images (SiteImagesService writes files under
  // ./uploads/site-images) back out at /uploads/site-images/<filename>. Public,
  // unauthenticated — these are decorative member-portal hero photos, not
  // sensitive personal data, matching how web/public/images is already served
  // openly. Local disk for now (see schema.prisma's SiteImage comment on
  // migrating to real object storage before a multi-instance deployment).
  // X-Content-Type-Options: nosniff — defense-in-depth alongside the upload-side
  // fileFilter (see common/image-upload.util.ts) that now rejects SVG/anything
  // else a browser could execute as script; this stops a browser from ever
  // re-sniffing a served file's content-type away from what's declared.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res: Response) =>
      res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

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
