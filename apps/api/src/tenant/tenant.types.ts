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
