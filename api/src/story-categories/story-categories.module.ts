import { Module } from '@nestjs/common';
import { StoryCategoriesController } from './story-categories.controller';
import { StoryCategoriesService } from './story-categories.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [StoryCategoriesController],
  providers: [StoryCategoriesService],
})
export class StoryCategoriesModule {}
