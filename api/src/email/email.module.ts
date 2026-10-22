import { Module } from '@nestjs/common';
import { TransactionalEmailService } from './transactional-email.service';
import { LoginCodeService } from './login-code.service';

@Module({
  providers: [TransactionalEmailService, LoginCodeService],
  exports: [TransactionalEmailService, LoginCodeService],
})
export class EmailModule {}
