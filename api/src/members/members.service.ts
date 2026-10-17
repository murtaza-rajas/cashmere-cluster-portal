import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ID_PREFIX, isDemoMember } from '../common/membership-access';
import { Gender, MembershipTier, Prisma, Region } from '@prisma/client';
import { ExternalIdentity } from '../auth/interfaces/identity-provider.interface';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ShopifyAdminApiService } from '../shopify-admin/shopify-admin-api.service';
import { GrantMembershipDto } from './dto/grant-membership.dto';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly shopifyApi: ShopifyAdminApiService,
  ) {}

  /**
   * Staff give someone a membership by hand — pilot customers (client
   * request 2026-10-17), the one exception to "paid tiers only via Shopify
   * payment". Finds the member by email, or creates them along with a bare
   * Shopify customer so they can sign in with that email. The term starts
   * today. Staff set exactly what they choose; the previous values go in the
   * audit log.
   */
  async grantMembership(dto: GrantMembershipDto, staffUserId: string) {
    const email = dto.email.trim();
    let member = await this.prisma.member.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        NOT: { shopifyCustomerId: { startsWith: DEMO_ID_PREFIX } },
      },
    });
    let created = false;
    let shopifyCustomerCreated = false;

    if (!member) {
      const customer = await this.shopifyApi.findOrCreateCustomer({
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      shopifyCustomerCreated = customer.created;
      member = await this.prisma.member.findUnique({
        where: { shopifyCustomerId: customer.customerId },
      });
      if (!member) {
        member = await this.prisma.member.create({
          data: {
            shopifyCustomerId: customer.customerId,
            email,
            firstName: dto.firstName || null,
            lastName: dto.lastName || null,
            membershipTier: MembershipTier.NEWSLETTER,
          },
        });
        created = true;
      }
    }

    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + dto.months);

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: {
        membershipTier: dto.tier,
        membershipStatus: 'ACTIVE',
        termLengthMonths: dto.months,
        membershipStartDate: start,
        membershipEndDate: end,
        isFoundingMember:
          dto.tier === MembershipTier.FOUNDING ? true : undefined,
      },
    });

    await this.auditLog.log({
      action: 'member.membership_granted',
      actorStaffUserId: staffUserId,
      targetType: 'Member',
      targetId: member.id,
      targetMemberId: member.id,
      metadata: {
        tier: dto.tier,
        months: dto.months,
        previousTier: member.membershipTier,
        previousStatus: member.membershipStatus,
        previousEndDate: member.membershipEndDate?.toISOString() ?? null,
        memberCreated: created,
        shopifyCustomerCreated,
      },
    });

    return { member: updated, created };
  }

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

  // Self-service profile edit (client requirement, 2026-10-03) — phoneNumber/
  // countryOfResidence/gender only, never the Shopify-synced identity fields.
  // An empty string means "clear this field", stored as null rather than "" so
  // the frontend's existing `?? "—"` display pattern keeps working unchanged.
  updateProfile(
    memberId: string,
    dto: { phoneNumber?: string; countryOfResidence?: string; gender?: Gender },
  ) {
    const toNullable = (value: string | undefined) =>
      value === undefined ? undefined : value === '' ? null : value;

    return this.prisma.member.update({
      where: { id: memberId },
      data: {
        phoneNumber: toNullable(dto.phoneNumber),
        countryOfResidence: toNullable(dto.countryOfResidence),
        gender: dto.gender,
      },
    });
  }

  // Nullable variant for the staff-facing member-detail lookup, where the id
  // comes from an untrusted URL param rather than a signed JWT — an unknown id
  // is a normal, expected case there (a clean 404), not a 500. findById() above
  // is left alone: every existing caller passes a trusted id from a validated
  // session, where a miss really would be an unexpected error.
  // `scopedRegion` (set for a regional role like Mongolia Editor — see
  // region-scope.util.ts) confines this to only members in that region —
  // a real Forbidden for a member outside scope, not a disguised 404,
  // matching EventsService/BenefitsService's own findOrThrow.
  async findByIdForStaff(id: string, scopedRegion: Region | null = null) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    if (scopedRegion && member.region !== scopedRegion) {
      throw new ForbiddenException(
        'This member is outside your regional scope',
      );
    }
    return member;
  }

  // Staff-facing directory (Members & Users admin) — case-insensitive search
  // across email/first/last name. No pagination yet (matches the simplicity
  // level of the rest of the admin backend so far — findAll() on StaffService
  // has none either); worth adding once real member volume makes that matter.
  async findAllForStaff(
    search: string | undefined,
    scopedRegion: Region | null,
  ) {
    const where: Prisma.MemberWhereInput = {
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(scopedRegion ? { region: scopedRegion } : {}),
    };

    const members = await this.prisma.member.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        membershipTier: true,
        membershipStatus: true,
        region: true,
        language: true,
        isFoundingMember: true,
        newsletterSubscribed: true,
        createdAt: true,
        shopifyCustomerId: true,
      },
    });
    // isDemo instead of the raw Shopify id, which staff lists don't need.
    return members.map(({ shopifyCustomerId, ...m }) => ({
      ...m,
      isDemo: isDemoMember({ shopifyCustomerId }),
    }));
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
