export interface AuthenticatedUser {
  id: string;
  membershipId: string;
  tenantId: string;
  tenantStatus: 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED';
  email: string;
  mfaEnabled: boolean;
  role: string;
  roleNames: string[];
  permissions: string[];
  storeIds: string[];
  allStoreAccess: boolean;
}

export interface LoginRequest {
  email: string;
  tenantSlug: string;
  password: string;
  mfaCode?: string;
}

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export interface EmailVerificationRequest {
  token: string;
}

export interface MfaCodeRequest {
  code: string;
}

export interface AuthenticationToken {
  userId: string;
  membershipId: string;
  sessionId: string;
}

export interface RegisterTenantRequest {
  tenantName: string;
  tenantSlug: string;
  businessType: 'RETAIL' | 'PHARMACY' | 'HYBRID';
  ownerName: string;
  ownerEmail: string;
  password: string;
  planCode: string;
}

export interface TenantRegistrationResult {
  status: 'PENDING_REVIEW';
  message: string;
}

export interface AcceptInvitationRequest {
  token: string;
  name: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}
