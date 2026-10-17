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

// The Club opens 1 November 2026.
const CLUB_LAUNCH_DATE = new Date('2026-11-01T00:00:00Z');

// Free tiers (Newsletter, Mongolia) rank 0 — any paid purchase replaces them.
const TIER_RANK: Record<MembershipTier, number> = {
  NEWSLETTER: 0,
  MONGOLIA: 0,
  SIX_MONTH: 1,
  ANNUAL: 2,
  FOUNDING: 3,
};

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

    let member = await this.prisma.member.findUnique({
      where: { shopifyCustomerId: String(payload.customer.id) },
    });

    if (!member) {
      // A paid membership purchase from someone who has never logged in to the
      // portal must still give them their membership — create the member from
      // the order. Any other order from an unknown customer stays ignored, so
      // ordinary store customers don't become members by buying something.
      const level =
        payload.financial_status === 'paid'
          ? await this.findMembershipLevel(payload)
          : null;
      if (!level) {
        this.logger.log(
          `Order ${payload.id} belongs to unknown customer ${payload.customer.id} — nothing to do`,
        );
        return;
      }
      member = await this.createMemberFromOrder(payload);
      if (!member) return;
    }

    const lineItems: Prisma.InputJsonValue | undefined =
      payload.line_items?.map((item) => ({
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
   * Auto-activation-on-payment. Fires from orders/create and orders/updated
   * — whichever delivery first reports `paid`.
   *
   * Matches on product_id (each membership product has exactly one variant).
   * MembershipLevel.shopifyProductId is the mapping (developer-set, not
   * staff-editable — see schema.prisma).
   *
   * Rules (2026-10-12):
   * - Each order counts once. Shopify re-sends orders/updated on every change
   *   to the order (fulfilment, notes, tags), so an already-applied order is
   *   skipped — otherwise every re-delivery would extend the term again.
   * - Never downgrade: the member keeps the higher of their current active
   *   level and the purchased one (a Founding member buying Annual stays
   *   Founding).
   * - Extend, don't reset: if their paid membership hasn't ended, the
   *   purchased term is added to the current end date.
   * - One-way: refunds/cancellations never deactivate (never scoped).
   */
  private async activateMembershipFromOrder(
    memberId: string,
    payload: ShopifyOrderPayload,
  ): Promise<void> {
    const level = await this.findMembershipLevel(payload);
    if (!level || !level.termLengthMonths) {
      return;
    }

    const alreadyApplied = await this.prisma.auditLog.findFirst({
      where: {
        action: 'member.tier_activated',
        targetMemberId: memberId,
        metadata: { path: ['shopifyOrderId'], equals: payload.id },
      },
      select: { id: true },
    });
    if (alreadyApplied) return;

    const member = await this.prisma.member.findUniqueOrThrow({
      where: { id: memberId },
    });

    const purchasedAt = new Date(payload.created_at);
    // Memberships bought before the Club opens start on launch day (client
    // decision 2026-10-17); from then on they start on the purchase date.
    const termStart =
      purchasedAt < CLUB_LAUNCH_DATE ? CLUB_LAUNCH_DATE : purchasedAt;
    // A paid tier with no end date (e.g. granted by hand) counts as active.
    const currentPaidActive =
      member.membershipStatus === 'ACTIVE' &&
      TIER_RANK[member.membershipTier] > 0 &&
      (member.membershipEndDate === null ||
        member.membershipEndDate > purchasedAt);

    const keepCurrentTier =
      currentPaidActive &&
      TIER_RANK[member.membershipTier] >= TIER_RANK[level.tier];
    const tier = keepCurrentTier ? member.membershipTier : level.tier;

    const startDate = currentPaidActive
      ? (member.membershipStartDate ?? termStart)
      : termStart;
    const endDate = new Date(
      currentPaidActive && member.membershipEndDate
        ? member.membershipEndDate
        : termStart,
    );
    endDate.setMonth(endDate.getMonth() + level.termLengthMonths);

    await this.prisma.member.update({
      where: { id: memberId },
      data: {
        membershipTier: tier,
        membershipStatus: 'ACTIVE',
        termLengthMonths: keepCurrentTier
          ? member.termLengthMonths
          : level.termLengthMonths,
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
        tier,
        purchasedTier: level.tier,
        extended: currentPaidActive,
        shopifyOrderId: payload.id,
        shopifyProductId: level.shopifyProductId,
        termLengthMonths: level.termLengthMonths,
        membershipEndDate: endDate.toISOString(),
      },
    });

    this.logger.log(
      `Member ${memberId} ${currentPaidActive ? 'extended' : 'activated'} as ${tier} from paid order ${payload.id}`,
    );
  }

  private async findMembershipLevel(payload: ShopifyOrderPayload) {
    const productIds = (payload.line_items ?? [])
      .map((item) => item.product_id)
      .filter((id): id is number => id !== null)
      .map(String);
    if (productIds.length === 0) return null;
    return this.prisma.membershipLevel.findFirst({
      where: { shopifyProductId: { in: productIds } },
    });
  }

  // Same starting shape as a first login (MembersService.findOrCreateFromIdentity):
  // NEWSLETTER tier, which activateMembershipFromOrder upgrades straight after.
  // Upsert, not create: orders/create and orders/updated can arrive together.
  private async createMemberFromOrder(payload: ShopifyOrderPayload) {
    const customer = payload.customer!;
    const email = customer.email ?? payload.email;
    if (!email) {
      this.logger.warn(
        `Paid membership order ${payload.id} for unknown customer ${customer.id} has no email — cannot create member`,
      );
      return null;
    }
    const shopifyCustomerId = String(customer.id);
    const member = await this.prisma.member.upsert({
      where: { shopifyCustomerId },
      update: {},
      create: {
        shopifyCustomerId,
        email,
        firstName: customer.first_name ?? undefined,
        lastName: customer.last_name ?? undefined,
        membershipTier: MembershipTier.NEWSLETTER,
      },
    });
    await this.auditLog.log({
      action: 'member.created',
      targetType: 'Member',
      targetId: member.id,
      targetMemberId: member.id,
      metadata: { source: 'shopify_order', shopifyOrderId: payload.id },
    });
    return member;
  }
}
