import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

// Read side of the audit trail — Super Administrator only, same as every other
// system-wide/security-sensitive area (Staff & Roles). Every other admin
// feature writes here already (see AuditLogService.log's callers); this is
// just the first place any of it can actually be read back.
@Controller('audit-log')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Super Administrator')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  findAll(
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('actorStaffUserId') actorStaffUserId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.auditLog.findAll({
      action,
      targetType,
      actorStaffUserId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('actions')
  findActions() {
    return this.auditLog.findDistinctActions();
  }
}
