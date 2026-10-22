import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import nodemailer, { type Transporter } from 'nodemailer';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Sends one-off emails (sign-in codes). Two ways out, picked by config:
// - SMTP (SMTP_HOST set): the client's ProISP mailbox no-reply@cashmerehouse.no
//   (decision 2026-10-22 — free, and stays in Norway). SMTP_USER defaults to
//   EMAIL_FROM_ADDRESS; port 465 = TLS, anything else = STARTTLS.
// - Otherwise Mailchimp Transactional (Mandrill), which needs a paid
//   Transactional block — in trial mode it rejects external recipients.
// The sender address is configured via EMAIL_FROM_ADDRESS.
//
// EMAIL_DELIVERY=log (development only) prints the email to the server log
// instead of sending it — never honoured in production, where it would
// expose sign-in codes in the logs.
@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);

  private smtp?: Transporter;

  constructor(private readonly config: ConfigService) {}

  private useSmtp(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  // Whether emails can actually go out (a sender plus SMTP or Mandrill
  // credentials, or dev log mode). The sign-in panel hides the email option
  // until this is true.
  isConfigured(): boolean {
    if (
      this.config.get<string>('EMAIL_DELIVERY') === 'log' &&
      process.env.NODE_ENV !== 'production'
    ) {
      return true;
    }
    if (!this.config.get<string>('EMAIL_FROM_ADDRESS')) return false;
    return this.useSmtp()
      ? Boolean(this.config.get<string>('SMTP_PASSWORD'))
      : Boolean(this.config.get<string>('MAILCHIMP_TRANSACTIONAL_API_KEY'));
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

    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Email sign-in isn't available yet — please sign in with Shopify.",
      );
    }
    const fromEmail = this.config.getOrThrow<string>('EMAIL_FROM_ADDRESS');
    const fromName =
      this.config.get<string>('EMAIL_FROM_NAME') ?? "Cashmere Lovers' Club";

    if (this.useSmtp()) {
      await this.sendSmtp(email, fromEmail, fromName);
      return;
    }

    const key = this.config.getOrThrow<string>(
      'MAILCHIMP_TRANSACTIONAL_API_KEY',
    );

    const { data } = await axios.post<
      { email: string; status: string; reject_reason?: string }[]
    >('https://mandrillapp.com/api/1.0/messages/send', {
      key,
      message: {
        from_email: fromEmail,
        from_name: fromName,
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

  private async sendSmtp(
    email: OutgoingEmail,
    fromEmail: string,
    fromName: string,
  ): Promise<void> {
    if (!this.smtp) {
      const port = Number(this.config.get<string>('SMTP_PORT') || 465);
      this.smtp = nodemailer.createTransport({
        host: this.config.getOrThrow<string>('SMTP_HOST'),
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: {
          user: this.config.get<string>('SMTP_USER') || fromEmail,
          pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
        },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
      });
    }
    try {
      await this.smtp.sendMail({
        from: { name: fromName, address: fromEmail },
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (err) {
      this.logger.error(
        `SMTP email to ${email.to} not sent: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        "We couldn't send the email right now — please try again shortly.",
      );
    }
  }
}
