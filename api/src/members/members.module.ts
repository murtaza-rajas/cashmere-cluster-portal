import { Module } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { DataSubjectRequestsModule } from '../data-subject-requests/data-subject-requests.module';
import { WishlistModule } from '../wishlist/wishlist.module';
import { StaffModule } from '../staff/staff.module';
import { BenefitsModule } from '../benefits/benefits.module';
import { SiteImagesModule } from '../site-images/site-images.module';
import { EventsModule } from '../events/events.module';
import { CareGuidesModule } from '../care-guides/care-guides.module';

@Module({
  // StaffModule needed for the Members & Users admin routes below (StaffAuthGuard
  // + RolesGuard, which itself depends on StaffService) — not re-exported
  // transitively via DataSubjectRequestsModule even though that module also
  // imports StaffModule, so it has to be imported here directly too.
  imports: [
    DataSubjectRequestsModule,
    WishlistModule,
    StaffModule,
    BenefitsModule,
    SiteImagesModule,
    EventsModule,
    CareGuidesModule,
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
