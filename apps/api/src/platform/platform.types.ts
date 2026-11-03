import { Request } from 'express';

export interface PlatformAdminPrincipal {
  id: string;
  email: string;
  name: string;
}

export interface RequestWithPlatformAdmin extends Request {
  platformAdmin?: PlatformAdminPrincipal;
  authSessionId?: string;
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
  mfaCode?: string;
}

export interface KybDocumentUploadRequest {
  documentName: string;
}

export interface KybDocumentReviewRequest {
  status: 'ACCEPTED' | 'REJECTED';
  note?: string;
}

export interface TenantRejectionRequest {
  reason: string;
}

export interface PlatformTenantListQuery {
  search?: string;
  status?: 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  page: number;
  pageSize: number;
}

export interface PlatformAdminInvitationRequest {
  email: string;
  name: string;
}

export interface PlatformAdminInvitationAcceptanceRequest {
  token: string;
  password: string;
}

export interface PlatformPlanVersionRequest {
  trialDays: number;
  billingPeriodDays: number;
  currency: string;
  price: string | null;
  entitlements: Record<string, unknown>;
}

export interface PlatformPlanCreateRequest extends PlatformPlanVersionRequest {
  code: string;
  name: string;
}

export interface PlatformSupportAccessRequest {
  tenantId: string;
  purpose: string;
  scopes: Array<'tenant_profile' | 'stores' | 'products' | 'sales_summary'>;
  durationMinutes: number;
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

export type FiscalJurisdiction = 'MAINLAND_TANZANIA' | 'ZANZIBAR';

export interface FiscalProviderConfigurationRequest {
  providerName: string;
  productionEndpoint: string | null;
  sandboxEndpoint: string | null;
  documentationUrl: string | null;
  approvalStatus: 'UNVERIFIED' | 'SANDBOX_VALIDATED' | 'AUTHORITY_APPROVED';
  approvalEvidenceReference: string | null;
  isAvailable: boolean;
  credentials?: Record<string, string>;
  clearCredentials?: boolean;
}

export interface FiscalAddonOfferRequest {
  isAvailable: boolean;
  monthlyPrice: string | null;
  annualPrice: string | null;
}

export type FiscalAddonBillingPeriod = 'MONTHLY' | 'ANNUAL';

export type FiscalAddonPaymentOutcome = 'PAID' | 'FAILED' | 'CANCELED' | 'TIMEOUT';

export interface FiscalAddonCheckoutRequest {
  jurisdiction: FiscalJurisdiction;
  billingPeriod: FiscalAddonBillingPeriod;
}

export interface FiscalAddonPaymentSimulationRequest {
  outcome: FiscalAddonPaymentOutcome;
  idempotencyKey: string;
}

export interface FiscalAddonRequestUpdate {
  status: 'CONTACTED' | 'CLOSED';
  message?: string | null;
}

export interface TenantFiscalProfileRequest {
  legalName: string | null;
  taxIdentificationNumber: string | null;
  vatRegistrationNumber: string | null;
  providerConfigurationId: string | null;
  credentials?: Record<string, string>;
  clearCredentials?: boolean;
}

export interface TenantFiscalAddonRequestCreate {
  jurisdiction: FiscalJurisdiction;
  message?: string | null;
}

export type FiscalSimulationScenario =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'TIMEOUT'
  | 'DUPLICATE'
  | 'RECOVERED';

export interface FiscalSimulationRequest {
  jurisdiction: FiscalJurisdiction;
  scenario: FiscalSimulationScenario;
}

export interface FiscalSimulationResult {
  simulationOnly: true;
  officialReceiptIssued: false;
  salesRecordCreated: false;
  taxCalculated: false;
  providerContacted: false;
  jurisdiction: FiscalJurisdiction;
  scenario: FiscalSimulationScenario;
  outcome:
    | 'SIMULATED_ACCEPTED'
    | 'SIMULATED_REJECTED'
    | 'SIMULATED_TIMEOUT'
    | 'SIMULATED_DUPLICATE'
    | 'SIMULATED_RECOVERED';
  simulationId: string;
  simulatedAt: string;
  message: string;
}