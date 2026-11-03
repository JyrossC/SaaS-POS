import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { URL } from 'node:url';

export const SMTP_TRANSPORT_FACTORY = Symbol('SMTP_TRANSPORT_FACTORY');

export interface SmtpTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
  auth?: { user: string; pass: string };
}

export interface OutboundEmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface OutboundEmailTransport {
  sendMail(message: OutboundEmailMessage): Promise<unknown>;
}

export type SmtpTransportFactory = (
  options: SmtpTransportOptions,
) => OutboundEmailTransport;

@Injectable()
export class EmailService {
  private transport?: OutboundEmailTransport;
  private fromAddress?: string;

  constructor(
    @Inject(SMTP_TRANSPORT_FACTORY)
    private readonly transportFactory: SmtpTransportFactory,
  ) {}

  async sendPasswordReset(to: string, token?: string): Promise<void> {
    const { transport, from } = this.getTransport();
    const resetUrl = token ? this.getResetUrl(token) : undefined;
    const instructions = resetUrl
      ? `Use this link to reset your password: ${resetUrl}\n\nThis link expires in 15 minutes and can only be used once.`
      : 'If an account exists for this address, password reset instructions will be sent.';

    await transport.sendMail({
      from,
      to,
      subject: 'Reset your SaaS POS password',
      text: [
        'We received a request to reset the password for this email address.',
        instructions,
        'If you did not request a password reset, you can ignore this message.',
      ].join('\n\n'),
      html: `<p>We received a request to reset the password for this email address.</p>${
        resetUrl
          ? `<p><a href="${this.escapeHtml(resetUrl)}">Reset your password</a></p><p>This link expires in 15 minutes and can only be used once.</p>`
          : '<p>If an account exists for this address, password reset instructions will be sent.</p>'
      }<p>If you did not request a password reset, you can ignore this message.</p>`,
    });
  }

  async sendEmailVerification(to: string, token?: string): Promise<void> {
    const { transport, from } = this.getTransport();
    const verificationUrl = token ? this.getAppUrl('/verify-email', token) : undefined;
    const instructions = verificationUrl
      ? `<p><a href="${this.escapeHtml(verificationUrl)}">Verify email address</a></p><p>This link expires in 24 hours and can only be used once.</p>`
      : '<p>If an account requires email verification, instructions will be sent.</p>';
    await transport.sendMail({
      from,
      to,
      subject: 'Verify your SaaS POS email address',
      text: [
        verificationUrl
          ? `Verify the email address for your SaaS POS account: ${verificationUrl}\n\nThis link expires in 24 hours and can only be used once.`
          : 'If an account requires email verification, instructions will be sent.',
        'If you did not create this account, you can ignore this message.',
      ].join('\n\n'),
      html: `<p>Verify the email address for your SaaS POS account.</p>${instructions}<p>If you did not create this account, you can ignore this message.</p>`,
    });
  }

  async sendPlatformAdminInvitation(to: string, name: string, token: string): Promise<void> {
    const { transport, from } = this.getTransport();
    const invitationUrl = this.getAppUrl('/platform/accept-invitation', token);
    await transport.sendMail({
      from,
      to,
      subject: 'Platform administrator invitation',
      text: [
        `Hello ${name},`,
        `You have been invited to administer SaaS POS. Set your password using this one-time link: ${invitationUrl}`,
        'The link expires in 24 hours. Multi-factor authentication is required when you sign in.',
        'If you were not expecting this invitation, you can ignore this message.',
      ].join('\n\n'),
      html: `<p>Hello ${this.escapeHtml(name)},</p><p>You have been invited to administer SaaS POS.</p><p><a href="${this.escapeHtml(invitationUrl)}">Set your platform administrator password</a></p><p>The link expires in 24 hours. Multi-factor authentication is required when you sign in.</p><p>If you were not expecting this invitation, you can ignore this message.</p>`,
    });
  }

  private getTransport(): { transport: OutboundEmailTransport; from: string } {
    if (this.transport && this.fromAddress) {
      return { transport: this.transport, from: this.fromAddress };
    }

    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.SMTP_FROM?.trim();
    const port = Number(process.env.SMTP_PORT ?? '587');
    const username = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;
    const secure = process.env.SMTP_SECURE === 'true';
    if (
      !host ||
      !from ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      Boolean(username) !== Boolean(password)
    ) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }

    const options: SmtpTransportOptions = {
      host,
      port,
      secure,
      requireTLS: !secure,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      ...(username && password ? { auth: { user: username, pass: password } } : {}),
    };
    this.transport = this.transportFactory(options);
    this.fromAddress = from;
    return { transport: this.transport, from };
  }

  private getResetUrl(token: string): string {
    return this.getAppUrl('/reset-password', token);
  }

  private getAppUrl(path: string, token: string): string {
    let appUrl: URL;
    try {
      appUrl = new URL(process.env.APP_URL ?? 'http://localhost:5173');
    } catch {
      throw new ServiceUnavailableException('The application URL for email links is invalid.');
    }
    if (
      (appUrl.protocol !== 'https:' && appUrl.protocol !== 'http:') ||
      appUrl.username ||
      appUrl.password
    ) {
      throw new ServiceUnavailableException('The application URL for email links is invalid.');
    }
    appUrl.pathname = path;
    appUrl.search = '';
    appUrl.hash = '';
    appUrl.searchParams.set('token', token);
    return appUrl.toString();
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return character;
      }
    });
  }
}
