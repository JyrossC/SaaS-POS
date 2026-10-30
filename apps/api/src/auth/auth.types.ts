export interface AuthenticatedUser {
  id: string;
  membershipId: string;
  tenantId: string;
  email: string;
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
}

export interface AuthenticationToken {
  userId: string;
  membershipId: string;
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
