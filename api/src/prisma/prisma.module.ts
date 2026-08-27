import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global so every feature module (members, staff, audit-log, etc.) can inject
// PrismaService without re-importing this module everywhere.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
