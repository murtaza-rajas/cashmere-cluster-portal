import { randomBytes, createHash } from 'crypto';

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function deriveCodeChallenge(codeVerifier: string): string {
  return base64url(createHash('sha256').update(codeVerifier).digest());
}

export function generateState(): string {
  return base64url(randomBytes(16));
}
