import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DataSubjectRequestType } from '@prisma/client';
import {
  ShopifyCustomersDataRequestPayload,
  ShopifyCustomersRedactPayload,
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
}
