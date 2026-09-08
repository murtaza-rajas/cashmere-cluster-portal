import { Module } from '@nestjs/common';
import { SiteImagesController } from './site-images.controller';
import { SiteImagesService } from './site-images.service';
import { StaffModule } from '../staff/staff.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [StaffModule, AuditLogModule],
  controllers: [SiteImagesController],
  providers: [SiteImagesService],
  // MembersModule needs this for the member-facing read endpoint
  // (GET /members/me/site-images) — the staff CRUD endpoints in this
  // module's own controller stay separately guarded either way.
  exports: [SiteImagesService],
})
export class SiteImagesModule {}
