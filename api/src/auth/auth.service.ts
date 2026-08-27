import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembersService } from '../members/members.service';
import { ExternalIdentity } from './interfaces/identity-provider.interface';

export interface SessionJwtPayload {
  sub: string; // our internal Member.id — never the Shopify id, so downstream code
  // never needs to know which identity provider was used.
}

@Injectable()
export class AuthService {
  constructor(
    private readonly members: MembersService,
    private readonly jwt: JwtService,
  ) {}

  /** Turns a verified external identity (from any IdentityProvider) into our own session token. */
  async issueSessionForIdentity(identity: ExternalIdentity): Promise<{ accessToken: string; memberId: string }> {
    const member = await this.members.findOrCreateFromIdentity(identity);
    const payload: SessionJwtPayload = { sub: member.id };
    return {
      accessToken: await this.jwt.signAsync(payload),
      memberId: member.id,
    };
  }
}
