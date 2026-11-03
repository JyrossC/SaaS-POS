export interface InviteStaffRequest {
  email: string;
  roleId: string;
}

export interface StaffInvitationResult {
  invitationId: string;
  email: string;
  role: string;
  expiresAt: Date;
}

export interface CreateTenantRoleRequest {
  name: string;
  description?: string | null;
  permissionCodes?: string[];
}

export interface UpdateTenantRoleRequest {
  name?: string;
  description?: string | null;
  permissionCodes?: string[];
}

export interface UpdateBusinessSettingsRequest {
  name: string;
  businessAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}
