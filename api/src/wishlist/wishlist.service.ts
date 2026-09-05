import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  findForMember(memberId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { memberId },
      orderBy: { addedAt: 'desc' },
    });
  }

  // Idempotent on (memberId, shopifyProductId) — clicking "Add to Wishlist"
  // again for a product already saved just returns the existing row rather
  // than erroring or duplicating it.
  async addItem(memberId: string, dto: AddWishlistItemDto) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        memberId_shopifyProductId: {
          memberId,
          shopifyProductId: dto.shopifyProductId,
        },
      },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.wishlistItem.create({
      data: { memberId, ...dto },
    });
  }

  async removeItem(memberId: string, itemId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { id: itemId },
    });
    if (!existing) {
      throw new NotFoundException('Wishlist item not found');
    }
    if (existing.memberId !== memberId) {
      throw new ForbiddenException();
    }

    await this.prisma.wishlistItem.delete({ where: { id: itemId } });
  }
}
