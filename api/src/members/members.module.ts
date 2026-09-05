import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { DataSubjectRequestsModule } from '../data-subject-requests/data-subject-requests.module';
import { WishlistModule } from '../wishlist/wishlist.module';

@Module({
  imports: [DataSubjectRequestsModule, WishlistModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
