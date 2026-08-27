import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ShopifyIdentityProvider } from './providers/shopify-identity.provider';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [
    MembersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ShopifyIdentityProvider, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
