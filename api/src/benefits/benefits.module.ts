import { Module } from '@nestjs/common';
import { BenefitsController } from './benefits.controller';
import { BenefitsService } from './benefits.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [BenefitsController],
  providers: [BenefitsService],
  // MembersModule needs this for the member-facing read endpoints
  // (GET /members/me/benefits, GET /members/me/offers) — the staff CRUD
  // endpoints in this module's own controller stay separately guarded either way.
  exports: [BenefitsService],
})
export class BenefitsModule {}
