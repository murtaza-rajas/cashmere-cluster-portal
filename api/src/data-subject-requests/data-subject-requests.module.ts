import { Module } from '@nestjs/common';
import { DataSubjectRequestsController } from './data-subject-requests.controller';
import { DataSubjectRequestsService } from './data-subject-requests.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [DataSubjectRequestsController],
  providers: [DataSubjectRequestsService],
})
export class DataSubjectRequestsModule {}
