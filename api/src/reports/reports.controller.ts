import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { ReportsService } from './reports.service';

// Analytics Viewer, per its seeded role description ("Read-only insight:
// reports and dashboards, no changes") — an exact match, same as Content
// Manager was for Care & Repair. Every endpoint here is read-only by design;
// there's nothing to guard beyond the role itself.
@Controller('reports')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Analytics Viewer')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('members/totals')
  memberTotals() {
    return this.reports.getMemberTotals();
  }

  @Get('members/tiers')
  tierBreakdown() {
    return this.reports.getTierBreakdown();
  }

  @Get('members/new')
  newMembers(
    @Query('period') period?: string,
    @Query('periods') periods?: string,
  ) {
    const validPeriod = period === 'month' ? 'month' : 'week';
    const count = periods ? Math.min(Math.max(Number(periods) || 8, 1), 52) : 8;
    return this.reports.getNewMembersByPeriod(validPeriod, count);
  }

  @Get('orders')
  orderTotals(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.getOrderTotals(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
