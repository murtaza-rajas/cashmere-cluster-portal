import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorFunction,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

// For AWS ALB/ECS target group health checks (or any load balancer/orchestrator) —
// returns 503 if the app can't reach the database, not just "the process is alive."
// A container that's up but DB-unreachable should be pulled out of rotation, not
// treated as healthy.
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const checkDatabase: HealthIndicatorFunction = async () => {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        return { database: { status: 'up' } };
      } catch (err) {
        // Terminus expects a HealthCheckError (not a raw error) to turn this into
        // the standard 503 response — letting the Prisma error escape directly
        // produced an unhandled 500 instead, which defeats the point of a health
        // check an ALB/ECS can actually key off.
        throw new HealthCheckError('database check failed', {
          database: { status: 'down', message: (err as Error).message },
        });
      }
    };

    return this.health.check([checkDatabase]);
  }
}
