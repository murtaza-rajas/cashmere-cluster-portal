import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { StaffModule } from './staff/staff.module';
import { HealthModule } from './health/health.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DataSubjectRequestsModule } from './data-subject-requests/data-subject-requests.module';
import { BenefitsModule } from './benefits/benefits.module';
import { SiteImagesModule } from './site-images/site-images.module';
import { EventsModule } from './events/events.module';
import { CareGuidesModule } from './care-guides/care-guides.module';
import { ReportsModule } from './reports/reports.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { StaffDashboardModule } from './staff-dashboard/staff-dashboard.module';
import { DesignsModule } from './designs/designs.module';
import { MongoliaModule } from './mongolia/mongolia.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditLogModule,
    MembersModule,
    AuthModule,
    StaffModule,
    HealthModule,
    WebhooksModule,
    DataSubjectRequestsModule,
    BenefitsModule,
    SiteImagesModule,
    EventsModule,
    CareGuidesModule,
    ReportsModule,
    IntegrationsModule,
    StaffDashboardModule,
    DesignsModule,
    MongoliaModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
