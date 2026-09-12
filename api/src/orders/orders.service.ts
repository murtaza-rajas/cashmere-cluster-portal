import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // Staff-facing: "Shopify & Orders admin view" (Milestone 5 checklist item)
  // — Commerce Manager's own seeded description is "Shopify and commercial
  // content: products, collections, discounts, order view", an exact match,
  // and the role existed unused since Milestone 1 until this. Deliberately
  // read-only — real order data is Shopify's own source of truth, synced in
  // by the order webhooks (shopify-webhooks.service.ts); nothing here
  // writes back to MemberOrderCache. Cross-member, unlike
  // MembersService.findOrdersForMember (a single member's own history) —
  // this is "browse everything that's come in," searchable by order number
  // or the member's name/email without having to find the member first.
  findAllForStaff(search?: string) {
    const where: Prisma.MemberOrderCacheWhereInput = search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: 'insensitive' } },
            { member: { email: { contains: search, mode: 'insensitive' } } },
            { member: { firstName: { contains: search, mode: 'insensitive' } } },
            { member: { lastName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    return this.prisma.memberOrderCache.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            membershipTier: true,
            region: true,
            isFoundingMember: true,
          },
        },
      },
    });
  }
}
