import { Request } from 'express';

export interface PlatformAdminPrincipal {
  id: string;
  email: string;
  name: string;
}

export interface RequestWithPlatformAdmin extends Request {
  platformAdmin?: PlatformAdminPrincipal;
}

export interface InstallationRequest {
  platformName: string;
  adminName: string;
  adminEmail: string;
  password: string;
}

export interface PlatformLoginRequest {
  email: string;
  password: string;
}

export interface KybDocumentUploadRequest {
  documentName: string;
}

export interface KybDocumentReviewRequest {
  status: 'ACCEPTED' | 'REJECTED';
  note?: string;
}

export type PaymentProviderName = 'AZAMPAY' | 'STRIPE' | 'BANK_TRANSFER';

export interface PlatformPaymentProviderConfig {
  displayName?: string;
  isEnabled?: boolean;
  isSandbox?: boolean;
  apiKey?: string | null;
  secretKey?: string | null;
  publicKey?: string | null;
  accountId?: string | null;
  metadata?: Record<string, unknown> | null;
}