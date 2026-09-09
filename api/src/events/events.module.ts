import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [EventsController],
  providers: [EventsService],
  // MembersModule needs this for the member-facing read endpoint
  // (GET /members/me/events) — the staff CRUD endpoints in this module's own
  // controller stay separately guarded either way.
  exports: [EventsService],
})
export class EventsModule {}
