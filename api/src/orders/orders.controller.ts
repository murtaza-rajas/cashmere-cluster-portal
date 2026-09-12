import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../staff/guards/staff-auth.guard';
import { RolesGuard } from '../staff/guards/roles.guard';
import { Roles } from '../staff/decorators/roles.decorator';
import { OrdersService } from './orders.service';

// Deliberately /order-catalog, not /orders — the member-facing "My Orders"
// page already owns that exact bare path (app/(member)/orders/page.tsx),
// same collision-avoidance reasoning as every other *-catalog route in
// this app.
@Controller('order-catalog')
@UseGuards(StaffAuthGuard, RolesGuard)
@Roles('Commerce Manager')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.orders.findAllForStaff(search);
  }
}
