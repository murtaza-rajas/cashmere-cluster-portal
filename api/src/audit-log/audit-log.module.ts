import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

// Global for the same reason as PrismaModule — every feature module needs to be able
// to write an audit entry without re-importing this everywhere.
@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
