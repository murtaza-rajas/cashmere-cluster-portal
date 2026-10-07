import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DataSubjectRequestType, MembershipTier, Prisma } from '@prisma/client';
import {
  ShopifyCustomersDataRequestPayload,
  ShopifyCustomersRedactPayload,
  ShopifyOrderPayload,
  ShopifyShopRedactPayload,
} from './types/shopify-webhook-payloads';

@Injectable()
export class ShopifyWebhooksService {
  private readonly logger = new Logger(ShopifyWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Shopify notifies us a customer (or the store owner on their behalf) requested
   * their data. This does NOT require us to return the data in the webhook
   * response — Shopify's own guidance is that the merchant has up to 30 days to
   * respond through their own process. What we do here: record the request so
   * staff can action it, and log it. Actually compiling/delivering the export is
   * deliberately not automated yet — that's real support-process work, not
   * something to fake with a half-built auto-export.
   */
  async handleCustomersDataRequest(
    payload: ShopifyCustomersDataRequestPayload,
  ): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { shopifyCustomerId: String(payload.customer.id) },
    });

    if (!member) {
      this.logger.log(
        `customers/data_request for unknown customer ${payload.customer.id} — nothing to do`,
      );
      return;
    }

    await this.prisma.dataSubjectRequest.create({
      data: {
        memberId: member.id,
        type: DataSubjectRequestType.ACCESS,
        sourceShopifyWebhookId: String(payload.data_request.id),
      },
    });

    await this.auditLog.log({
      action: 'member.data_request_received',
      targetType: 'Member',
      targetId: member.id,
      targetMemberId: member.id,
      metadata: {
        shopifyDataRequestId: payload.data_request.id,
        shopDomain: payload.shop_domain,
      },
    });
  }

  /**
   * Shopify requires the customer's personal data actually be erased. We delete
   * the Member row outright (cascades MemberOrderCache and any DataSubjectRequest
   * rows — see schema.prisma) rather than a DataSubjectRequest record, because a
   * DataSubjectRequest tied to this member would itself cascade away the moment
   * we delete the member, which would defeat the point of keeping a compliance
   * trail. The AuditLog entry is written first and deliberately uses SetNull (not
   * Cascade) on its Member relation specifically so this record survives the
   * deletion it's describing.
   */
  async handleCustomersRedact(
    payload: ShopifyCustomersRedactPayload,
  ): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { shopifyCustomerId: String(payload.customer.id) },
    });

    if (!member) {
      this.logger.log(
        `customers/redact for unknown customer ${payload.customer.id} — nothing to do`,
      );
      return;
    }

    await this.auditLog.log({
      action: 'member.redacted',
      targetType: 'Member',
      targetId: member.id,
      targetMemberId: member.id,
      reason: 'Shopify customers/redact webhook',
      metadata: {
        shopifyCustomerId: payload.customer.id,
        shopDomain: payload.shop_domain,
      },
    });

    await this.prisma.member.delete({ where: { id: member.id } });
  }

  /**
   * Shopify requires all data for the shop be erased once the app is uninstalled.
   * Single-tenant assumption: this deployment serves exactly one Shopify shop
   * (Cashmere Lovers Club, Phase 1), so "redact this shop's data" means every
   * Member. If this platform ever serves multiple shops, Member needs a
   * shopDomain column to scope this correctly — it doesn't have one today.
   */
  async handleShopRedact(payload: ShopifyShopRedactPayload): Promise<void> {
    const members = await this.prisma.member.findMany({ select: { id: true } });

    for (const { id } of members) {
      await this.auditLog.log({
        action: 'member.redacted',
        targetType: 'Member',
        targetId: id,
        targetMemberId: id,
        reason: 'Shopify shop/redact webhook (app uninstalled)',
        metadata: { shopDomain: payload.shop_domain, shopId: payload.shop_id },
      });
    }

    await this.prisma.member.deleteMany({});
    this.logger.warn(
      `shop/redact: deleted ${members.length} member(s) for shop ${payload.shop_domain}`,
    );
  }

  /**
   * Keeps MemberOrderCache (a read-only summary, never the system of record — see
   * schema.prisma) in sync with real Shopify orders. Shared by orders/create and
   * orders/updated, both firing this same upsert keyed on shopifyOrderId, so a
   * status change (e.g. pending → paid) after the initial order just updates the
   * existing row rather than duplicating it. Not audit-logged: this is routine
   * commercial data sync, not a sensitive administrative action (see AuditLog's
   * intended scope in schema.prisma's top comment).
   */
  async handleOrderSync(payload: ShopifyOrderPayload): Promise<void> {
    if (!payload.customer) {
      this.logger.log(
        `Order ${payload.id} has no customer (guest checkout) — nothing to attach it to`,
      );
      return;
    }

    const member = await this.prisma.member.findUnique({
      where: { shopifyCustomerId: String(payload.customer.id) },
    });

    if (!member) {
      this.logger.log(
        `Order ${payload.id} belongs to unknown customer ${payload.customer.id} — nothing to do`,
      );
      return;
    }

    const lineItems: Prisma.InputJsonValue | undefined = payload.line_items?.map((item) => ({
      productId: item.product_id !== null ? String(item.product_id) : null,
      title: item.title,
      variantTitle: item.variant_title,
      quantity: item.quantity,
      price: item.price,
    }));

    await this.prisma.memberOrderCache.upsert({
      where: { shopifyOrderId: String(payload.id) },
      create: {
        memberId: member.id,
        shopifyOrderId: String(payload.id),
        orderNumber: payload.name,
        totalAmount: payload.total_price,
        currency: payload.currency,
        status: payload.financial_status,
        orderDate: new Date(payload.created_at),
        lineItems,
      },
      update: {
        totalAmount: payload.total_price,
        currency: payload.currency,
        status: payload.financial_status,
        lineItems,
      },
    });

    if (payload.financial_status === 'paid') {
      await this.activateMembershipFromOrder(member.id, payload);
    }
  }

  /**
   * Auto-activation-on-payment (Milestone 4, built 2026-10-07 once real
   * Shopify products/variant IDs existed to match against). Fires from both
   * orders/create (an instant payment method) and orders/updated (pending →
   * paid later) — whichever delivery first reports `paid` triggers this, and
   * re-delivery of an already-processed paid order is a harmless no-op (same
   * values written again).
   *
   * Matches on product_id, not a specific variant — each real membership
   * product (Founding/Annual/6-Month) has exactly one variant ("Default
   * Title"), so the product itself is the real identity of what was bought.
   * MembershipLevel.shopifyProductId is the mapping (developer-set, not
   * staff-editable — see schema.prisma's comment on why).
   *
   * Deliberately one-way: this activates/extends a membership, it never
   * downgrades or deactivates one on a refund/cancellation — that lifecycle
   * was never scoped and isn't built here. If an order somehow contains more
   * than one membership-product line item (not a real purchase flow Explore
   * Membership offers — one plan at a time), the first match wins; this
   * isn't trying to handle that as a real case.
   */
  private async activateMembershipFromOrder(
    memberId: string,
    payload: ShopifyOrderPayload,
  ): Promise<void> {
    const productIds = (payload.line_items ?? [])
      .map((item) => item.product_id)
      .filter((id): id is number => id !== null)
      .map(String);
    if (productIds.length === 0) return;

    const level = await this.prisma.membershipLevel.findFirst({
      where: { shopifyProductId: { in: productIds } },
    });
    if (!level || !level.termLengthMonths) {
      return;
    }

    const startDate = new Date(payload.created_at);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + level.termLengthMonths);

    await this.prisma.member.update({
      where: { id: memberId },
      data: {
        membershipTier: level.tier,
        membershipStatus: 'ACTIVE',
        termLengthMonths: level.termLengthMonths,
        membershipStartDate: startDate,
        membershipEndDate: endDate,
        // Permanent once granted, per the client's own spec — never cleared
        // by a later, different purchase.
        isFoundingMember:
          level.tier === MembershipTier.FOUNDING ? true : undefined,
        originatingShopifyOrderId: String(payload.id),
      },
    });

    await this.auditLog.log({
      action: 'member.tier_activated',
      targetType: 'Member',
      targetId: memberId,
      targetMemberId: memberId,
      metadata: {
        tier: level.tier,
        shopifyOrderId: payload.id,
        shopifyProductId: level.shopifyProductId,
        termLengthMonths: level.termLengthMonths,
      },
    });

    this.logger.log(
      `Member ${memberId} activated to ${level.tier} from paid order ${payload.id}`,
    );
  }
}
