import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipTier } from '@prisma/client';
import { ExternalIdentity } from '../auth/interfaces/identity-provider.interface';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds the member tied to this Shopify identity, or creates one.
   * New members default to the free NEWSLETTER tier — nothing here ever grants
   * paid/Founding status. That only happens via the Shopify order/payment webhook
   * flow (Milestone 4), matching the client's "no manual approval, activation on
   * payment" rule.
   */
  async findOrCreateFromIdentity(identity: ExternalIdentity) {
    const existing = await this.prisma.member.findUnique({
      where: { shopifyCustomerId: identity.externalId },
    });
    if (existing) {
      // Keep the cached contact fields fresh — Shopify remains the source of truth.
      return this.prisma.member.update({
        where: { id: existing.id },
        data: {
          email: identity.email,
          firstName: identity.firstName,
          lastName: identity.lastName,
        },
      });
    }

    return this.prisma.member.create({
      data: {
        shopifyCustomerId: identity.externalId,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        membershipTier: MembershipTier.NEWSLETTER,
      },
    });
  }

  findById(id: string) {
    return this.prisma.member.findUniqueOrThrow({ where: { id } });
  }
}
