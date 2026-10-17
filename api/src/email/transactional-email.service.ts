import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Sends one-off emails (sign-in codes) through Mailchimp Transactional
// (Mandrill). The sender address is the client's choice and is configured
// via EMAIL_FROM_ADDRESS; the domain must be verified in Mailchimp.
//
// EMAIL_DELIVERY=log (development only) prints the email to the server log
// instead of sending it — never honoured in production, where it would
// expose sign-in codes in the logs.
@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);

  constructor(private readonly config: ConfigService) {}

  // Whether emails can actually go out (key + sender configured, or dev log
  // mode). The sign-in panel hides the email option until this is true.
  isConfigured(): boolean {
    if (
      this.config.get<string>('EMAIL_DELIVERY') === 'log' &&
      process.env.NODE_ENV !== 'production'
    ) {
      return true;
    }
    return Boolean(
      this.config.get<string>('MAILCHIMP_TRANSACTIONAL_API_KEY') &&
      this.config.get<string>('EMAIL_FROM_ADDRESS'),
    );
  }

  async send(email: OutgoingEmail): Promise<void> {
    if (
      this.config.get<string>('EMAIL_DELIVERY') === 'log' &&
      process.env.NODE_ENV !== 'production'
    ) {
      this.logger.log(
        `[EMAIL_DELIVERY=log] to=${email.to} subject="${email.subject}"\n${email.text}`,
      );
      return;
    }

    const key = this.config.get<string>('MAILCHIMP_TRANSACTIONAL_API_KEY');
    const fromEmail = this.config.get<string>('EMAIL_FROM_ADDRESS');
    if (!key || !fromEmail) {
      throw new ServiceUnavailableException(
        "Email sign-in isn't available yet — please sign in with Shopify.",
      );
    }

    const { data } = await axios.post<
      { email: string; status: string; reject_reason?: string }[]
    >('https://mandrillapp.com/api/1.0/messages/send', {
      key,
      message: {
        from_email: fromEmail,
        from_name:
          this.config.get<string>('EMAIL_FROM_NAME') ?? "Cashmere Lovers' Club",
        to: [{ email: email.to, type: 'to' }],
        subject: email.subject,
        text: email.text,
        html: email.html,
        track_opens: false,
        track_clicks: false,
      },
    });

    const result = data[0];
    if (
      !result ||
      result.status === 'rejected' ||
      result.status === 'invalid'
    ) {
      this.logger.error(
        `Transactional email to ${email.to} not sent: ${result?.status} ${result?.reject_reason ?? ''}`,
      );
      throw new ServiceUnavailableException(
        "We couldn't send the email right now — please try again shortly.",
      );
    }
  }
}
