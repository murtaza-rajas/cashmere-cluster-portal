import { Module } from '@nestjs/common';
import { MembershipLevelsController } from './membership-levels.controller';
import { MembershipLevelsService } from './membership-levels.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [MembershipLevelsController],
  providers: [MembershipLevelsService],
})
export class MembershipLevelsModule {}
