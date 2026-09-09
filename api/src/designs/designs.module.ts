import { Module } from '@nestjs/common';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [DesignsController],
  providers: [DesignsService],
  exports: [DesignsService],
})
export class DesignsModule {}
