import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { SessionController } from './session.controller';
import { AuthService } from './auth.service';
import { ShopifyIdentityProvider } from './providers/shopify-identity.provider';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MembersModule } from '../members/members.module';
import { EmailModule } from '../email/email.module';
import { EmailLoginController } from './email-login/email-login.controller';
import { EmailLoginService } from './email-login/email-login.service';

@Module({
  imports: [
    MembersModule,
    EmailModule,
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
  controllers: [AuthController, SessionController, EmailLoginController],
  providers: [
    AuthService,
    ShopifyIdentityProvider,
    JwtStrategy,
    EmailLoginService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
