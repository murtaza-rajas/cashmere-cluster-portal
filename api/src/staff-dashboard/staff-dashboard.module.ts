import { Module } from '@nestjs/common';
import { StaffModule } from '../staff/staff.module';
import { StaffDashboardController } from './staff-dashboard.controller';
import { StaffDashboardService } from './staff-dashboard.service';

@Module({
  imports: [StaffModule],
  controllers: [StaffDashboardController],
  providers: [StaffDashboardService],
})
export class StaffDashboardModule {}
