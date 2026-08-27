import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Separate from members/auth.service.ts on purpose — staff and member sessions must
// never be interchangeable (different secret, different cookie, different guard).
// No public "login" method yet: how staff actually authenticate (magic link,
// Auth0/Cognito, Passkeys) is exactly what the Milestone 1 auth evaluation decides.
// This exists so that whatever login flow is chosen only needs to call
// `signSessionToken` at the end — everything downstream (RolesGuard, StaffService) is
// already built and doesn't change.
@Injectable()
export class StaffAuthService {
  constructor(private readonly jwt: JwtService) {}

  signSessionToken(staffUserId: string): Promise<string> {
    return this.jwt.signAsync({ sub: staffUserId });
  }
}
