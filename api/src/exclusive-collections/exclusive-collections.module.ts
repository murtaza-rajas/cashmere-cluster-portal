import { Module } from '@nestjs/common';
import { ExclusiveCollectionsController } from './exclusive-collections.controller';
import { ExclusiveCollectionsService } from './exclusive-collections.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [ExclusiveCollectionsController],
  providers: [ExclusiveCollectionsService],
  // MembersModule needs this for the member-facing read endpoint
  // (GET /members/me/exclusive-collections) — the staff CRUD endpoints in
  // this module's own controller stay separately guarded either way.
  exports: [ExclusiveCollectionsService],
})
export class ExclusiveCollectionsModule {}
