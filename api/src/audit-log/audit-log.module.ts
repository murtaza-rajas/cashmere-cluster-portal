import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { StaffModule } from '../staff/staff.module';

// Global for the same reason as PrismaModule — every feature module needs to be able
// to write an audit entry without re-importing this everywhere. StaffModule is
// imported (not just relied on implicitly) for StaffAuthGuard/RolesGuard on the
// new read endpoint below — safe to import directly here: StaffModule doesn't
// import AuditLogModule back (it gets AuditLogService for free via @Global), so
// there's no circular dependency to work around.
@Global()
@Module({
  imports: [StaffModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
