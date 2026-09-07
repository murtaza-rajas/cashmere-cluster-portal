import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { DataSubjectRequestsModule } from '../data-subject-requests/data-subject-requests.module';
import { WishlistModule } from '../wishlist/wishlist.module';
import { StaffModule } from '../staff/staff.module';

@Module({
  // StaffModule needed for the Members & Users admin routes below (StaffAuthGuard
  // + RolesGuard, which itself depends on StaffService) — not re-exported
  // transitively via DataSubjectRequestsModule even though that module also
  // imports StaffModule, so it has to be imported here directly too.
  imports: [DataSubjectRequestsModule, WishlistModule, StaffModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
