import { Module } from '@nestjs/common';
import { WishlistService } from './wishlist.service';

@Module({
  providers: [WishlistService],
  // Consumed by MembersModule for the member-facing self-service endpoints
  // (GET/POST/DELETE /members/me/wishlist) — no standalone controller of its
  // own yet since nothing (staff or otherwise) needs to view it separately.
  exports: [WishlistService],
})
export class WishlistModule {}
