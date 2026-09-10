import { Module } from '@nestjs/common';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MongoliaController } from './mongolia.controller';
import { MongoliaService } from './mongolia.service';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [MongoliaController],
  providers: [MongoliaService],
  exports: [MongoliaService],
})
export class MongoliaModule {}
