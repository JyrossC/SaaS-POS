import { ServiceUnavailableException } from '@nestjs/common';
import {
  EmailService,
  OutboundEmailMessage,
  OutboundEmailTransport,
  SmtpTransportOptions,
} from './email.service';

describe('EmailService', () => {
  const previous = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
    secure: process.env.SMTP_SECURE,
    appUrl: process.env.APP_URL,
  };
  const message: OutboundEmailMessage = {
    from: 'noreply@example.com',
    to: 'owner@example.com',
    subject: 'Reset your SaaS POS password',
    text: '',
    html: '',
  };
  let sendMail: jest.Mock<Promise<unknown>, [OutboundEmailMessage]>;
  let factory: jest.Mock<OutboundEmailTransport, [SmtpTransportOptions]>;
  let service: EmailService;

  beforeEach(() => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASSWORD = 'smtp-password';
    process.env.SMTP_FROM = 'noreply@example.com';
    process.env.SMTP_SECURE = 'false';
    process.env.APP_URL = 'https://pos.example.com';
    sendMail = jest.fn().mockResolvedValue({});
    factory = jest.fn().mockReturnValue({ sendMail });
    service = new EmailService(factory);
  });

  afterAll(() => {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('SMTP_HOST', previous.host);
    restore('SMTP_PORT', previous.port);
    restore('SMTP_USER', previous.user);
    restore('SMTP_PASSWORD', previous.password);
    restore('SMTP_FROM', previous.from);
    restore('SMTP_SECURE', previous.secure);
    restore('APP_URL', previous.appUrl);
  });

  it('sends a one-time reset URL over authenticated STARTTLS SMTP', async () => {
    await service.sendPasswordReset('owner@example.com', 'signed.reset.token');

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: 'smtp-user', pass: 'smtp-password' },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        from: 'noreply@example.com',
        text: expect.stringContaining(
          'https://pos.example.com/reset-password?token=signed.reset.token',
        ),
        html: expect.stringContaining(
          'https://pos.example.com/reset-password?token=signed.reset.token',
        ),
      }),
    );
  });

  it('sends a time-limited platform administrator invitation', async () => {
    await service.sendPlatformAdminInvitation('admin@example.com', '<Admin>', 'invite.token');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'Platform administrator invitation',
        text: expect.stringContaining(
          'https://pos.example.com/platform/accept-invitation?token=invite.token',
        ),
        html: expect.stringContaining('&lt;Admin&gt;'),
      }),
    );
  });

  it('sends the same generic instruction when no account token is supplied', async () => {
    await service.sendPasswordReset('unknown@example.com');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'unknown@example.com',
        text: expect.stringContaining('If an account exists for this address'),
      }),
    );
    expect(sendMail.mock.calls[0][0].text).not.toContain('reset-password?token=');
  });

  it('fails explicitly when SMTP settings are incomplete', async () => {
    delete process.env.SMTP_HOST;

    await expect(service.sendPasswordReset('owner@example.com')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(factory).not.toHaveBeenCalled();
  });

  it('does not silently downgrade authenticated SMTP to plaintext', async () => {
    process.env.SMTP_PASSWORD = '';

    await expect(service.sendPasswordReset('owner@example.com')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
