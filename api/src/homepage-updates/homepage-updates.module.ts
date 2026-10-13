import { Module } from '@nestjs/common';
import { HomepageUpdatesController } from './homepage-updates.controller';
import { HomepageUpdatesService } from './homepage-updates.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [HomepageUpdatesController],
  providers: [HomepageUpdatesService],
  // MembersModule needs this for the member-facing read endpoint
  // (GET /members/me/homepage-update) — the staff CRUD endpoints in
  // this module's own controller stay separately guarded either way.
  exports: [HomepageUpdatesService],
})
export class HomepageUpdatesModule {}
