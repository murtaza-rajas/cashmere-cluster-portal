import { Module } from '@nestjs/common';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  // MembersModule needs this for the member-facing read endpoint
  // (GET /members/me/stories).
  exports: [StoriesService],
})
export class StoriesModule {}
