import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipTier, Prisma } from '@prisma/client';
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
  // webhooks. Empty until real orders sync in; the frontend shows that honestly
  // rather than inventing data.
  findOrdersForMember(memberId: string) {
    return this.prisma.memberOrderCache.findMany({
      where: { memberId },
      orderBy: { orderDate: 'desc' },
    });
  }

  // "My Collection" — the pieces a member actually owns, flattened out of their
  // orders' line items (MemberOrderCache.lineItems, populated by the order-sync
  // webhook — see shopify-webhooks.service.ts). No merging/deduping across orders:
  // each purchase is its own entry, newest order first — simpler and avoids
  // inventing a "same product across orders" business rule nobody has asked for.
  async findCollectionForMember(memberId: string) {
    const orders = await this.prisma.memberOrderCache.findMany({
      where: { memberId, lineItems: { not: Prisma.JsonNull } },
      orderBy: { orderDate: 'desc' },
      select: { orderNumber: true, orderDate: true, lineItems: true },
    });

    return orders.flatMap((order) => {
      const items = order.lineItems as unknown as Array<{
        productId: string | null;
        title: string;
        variantTitle: string | null;
        quantity: number;
        price: string;
      }> | null;
      if (!items) return [];
      return items.map((item) => ({
        ...item,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
      }));
    });
  }
}
