import { Module } from '@nestjs/common';
import { CareGuidesController } from './care-guides.controller';
import { CareGuidesService } from './care-guides.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [CareGuidesController],
  providers: [CareGuidesService],
  // MembersModule needs this for the member-facing read endpoint
  // (GET /members/me/care-guides).
  exports: [CareGuidesService],
})
export class CareGuidesModule {}
