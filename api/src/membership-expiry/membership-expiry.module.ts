import { Module } from '@nestjs/common';
import { MembershipExpiryService } from './membership-expiry.service';

@Module({
  providers: [MembershipExpiryService],
  exports: [MembershipExpiryService],
})
export class MembershipExpiryModule {}
