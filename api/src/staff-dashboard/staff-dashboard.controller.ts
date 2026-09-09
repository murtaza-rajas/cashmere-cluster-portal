import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { StaffDashboardService } from './staff-dashboard.service';

// No @Roles()/RolesGuard here, deliberately — this is the staff landing
// page's own overview data, same "any authenticated staff member can view
// it" posture the /staff home page already has today. Individual Quick
// Action destinations stay role-gated at their own controllers (Benefits,
// Events, GDPR requests, etc.) exactly as they are now; a staff member who
// can't reach one just hits that page's own redirect.
@Controller('staff-dashboard')
@UseGuards(StaffAuthGuard)
export class StaffDashboardController {
  constructor(private readonly dashboard: StaffDashboardService) {}

  @Get('stats')
  stats() {
    return this.dashboard.getStats();
  }

  @Get('growth')
  growth(@Query('months') months?: string) {
    const count = months ? Math.min(Math.max(Number(months) || 6, 1), 24) : 6;
    return this.dashboard.getGrowth(count);
  }

  @Get('recent-members')
  recentMembers(@Query('limit') limit?: string) {
    const count = limit ? Math.min(Math.max(Number(limit) || 5, 1), 20) : 5;
    return this.dashboard.getRecentMembers(count);
  }

  @Get('recent-activity')
  recentActivity(@Query('limit') limit?: string) {
    const count = limit ? Math.min(Math.max(Number(limit) || 5, 1), 20) : 5;
    return this.dashboard.getRecentActivity(count);
  }

  @Get('pending-tasks')
  pendingTasks() {
    return this.dashboard.getPendingTasks();
  }
}
