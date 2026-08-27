import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StaffService } from './staff.service';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtStrategy } from './strategies/staff-jwt.strategy';
import { StaffController } from './staff.controller';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule,
    // Deliberately a second, independently-configured JwtModule instance (own secret,
    // own token) — not the same one members/auth.module.ts registers. See
    // staff-auth.service.ts for why staff and member sessions must stay unmixable.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('STAFF_JWT_SECRET'),
        signOptions: { expiresIn: '12h' }, // shorter than member sessions — staff access is more sensitive
      }),
    }),
  ],
  controllers: [StaffController],
  providers: [StaffService, StaffAuthService, StaffJwtStrategy, RolesGuard],
  exports: [StaffService, StaffAuthService],
})
export class StaffModule {}
