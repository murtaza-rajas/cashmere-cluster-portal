import { Module } from '@nestjs/common';
import { DataSubjectRequestsController } from './data-subject-requests.controller';
import { DataSubjectRequestsService } from './data-subject-requests.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [DataSubjectRequestsController],
  providers: [DataSubjectRequestsService],
  // MembersModule needs this for the member-facing self-service endpoints
  // (GET/POST /members/me/data-requests) — the staff queue endpoints in this
  // module's own controller stay separately guarded either way.
  exports: [DataSubjectRequestsService],
})
export class DataSubjectRequestsModule {}
