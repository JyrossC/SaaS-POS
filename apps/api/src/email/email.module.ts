import { Module } from '@nestjs/common';
import nodemailer from 'nodemailer';
import {
  EmailService,
  SmtpTransportFactory,
  SMTP_TRANSPORT_FACTORY,
} from './email.service';

const smtpTransportFactory: SmtpTransportFactory = (options) =>
  nodemailer.createTransport(options);

@Module({
  providers: [
    { provide: SMTP_TRANSPORT_FACTORY, useValue: smtpTransportFactory },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
