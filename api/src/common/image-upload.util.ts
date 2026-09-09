import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

// Explicit raster-format allowlist — NOT a blanket `mimetype.startsWith('image/')`
// check. That check (used here until a real stored-XSS was found and fixed) let
// image/svg+xml through: SVG is a valid, common image MIME type, but a browser
// executes any <script>/onload it contains when the file is opened directly or
// embedded via <object>/<iframe> — confirmed live (uploaded a real SVG payload
// through this exact filter, then opened its served URL and watched the script
// run in the API's own origin). None of these upload spots need vector images —
// real staff-uploaded hero/event photos are always going to be one of these —
// so excluding SVG (and anything else that isn't a plain raster format) closes
// the vector without needing content-sniffing/magic-byte verification: none of
// these formats carry executable content, regardless of what a client claims in
// the multipart Content-Type header.
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function imageOnlyFileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    callback(
      new BadRequestException('Only JPEG, PNG, WebP or GIF images are allowed'),
      false,
    );
    return;
  }
  callback(null, true);
}
