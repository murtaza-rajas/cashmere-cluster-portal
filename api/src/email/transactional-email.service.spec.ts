import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { TransactionalEmailService } from './transactional-email.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

const createTransport = nodemailer.createTransport as jest.Mock;

function serviceWith(env: Record<string, string>) {
  const config = {
    get: (key: string) => env[key],
    getOrThrow: (key: string) => {
      if (env[key] === undefined) throw new Error(`missing ${key}`);
      return env[key];
    },
  } as unknown as ConfigService;
  return new TransactionalEmailService(config);
}

const SMTP_ENV = {
  EMAIL_FROM_ADDRESS: 'no-reply@cashmerehouse.no',
  SMTP_HOST: 'smtp.example.no',
  SMTP_PORT: '465',
  SMTP_USER: '',
  SMTP_PASSWORD: 'secret',
};

const EMAIL = {
  to: 'member@example.com',
  subject: 'Your code',
  text: 'Your code is 123456',
  html: '<p>Your code is 123456</p>',
};

describe('TransactionalEmailService over SMTP', () => {
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({});
    createTransport.mockReset().mockReturnValue({ sendMail });
  });

  it('is configured only with a sender and an SMTP password', () => {
    expect(serviceWith(SMTP_ENV).isConfigured()).toBe(true);
    expect(serviceWith({ ...SMTP_ENV, SMTP_PASSWORD: '' }).isConfigured()).toBe(
      false,
    );
    expect(
      serviceWith({ ...SMTP_ENV, EMAIL_FROM_ADDRESS: '' }).isConfigured(),
    ).toBe(false);
  });

  it('sends from the configured address, logging in as it when SMTP_USER is blank', async () => {
    await serviceWith(SMTP_ENV).send(EMAIL);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.no',
        port: 465,
        secure: true,
        auth: { user: 'no-reply@cashmerehouse.no', pass: 'secret' },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: {
        name: "Cashmere Lovers' Club",
        address: 'no-reply@cashmerehouse.no',
      },
      to: 'member@example.com',
      subject: 'Your code',
      text: 'Your code is 123456',
      html: '<p>Your code is 123456</p>',
    });
  });

  it('uses STARTTLS on port 587', async () => {
    await serviceWith({ ...SMTP_ENV, SMTP_PORT: '587' }).send(EMAIL);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false, requireTLS: true }),
    );
  });

  it('turns an SMTP failure into a friendly 503', async () => {
    sendMail.mockRejectedValue(new Error('535 Authentication failed'));
    await expect(serviceWith(SMTP_ENV).send(EMAIL)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('refuses to send when nothing is configured', async () => {
    await expect(serviceWith({}).send(EMAIL)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(createTransport).not.toHaveBeenCalled();
  });
});
