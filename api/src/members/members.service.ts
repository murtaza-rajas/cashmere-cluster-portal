import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipTier } from '@prisma/client';
import { ExternalIdentity } from '../auth/interfaces/identity-provider.interface';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

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

    const created = await this.prisma.member.create({
      data: {
        shopifyCustomerId: identity.externalId,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        membershipTier: MembershipTier.NEWSLETTER,
      },
    });

    // System-initiated (no actorStaffUserId) — this happens automatically on first
    // login, not via a staff action.
    await this.auditLog.log({
      action: 'member.created',
      targetType: 'Member',
      targetId: created.id,
      targetMemberId: created.id,
      metadata: {
        source: 'shopify_login',
        membershipTier: created.membershipTier,
      },
    });

    return created;
  }

  findById(id: string) {
    return this.prisma.member.findUniqueOrThrow({ where: { id } });
  }

  // Read-only summary cache (see schema.prisma) — kept in sync via Shopify order
  // webhooks, which aren't built yet (Milestone 4), so this will legitimately return
  // an empty list for every member until then. The frontend shows that honestly
  // rather than inventing data.
  findOrdersForMember(memberId: string) {
    return this.prisma.memberOrderCache.findMany({
      where: { memberId },
      orderBy: { orderDate: 'desc' },
    });
  }
}
