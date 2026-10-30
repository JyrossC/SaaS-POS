import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { InviteStaffRequest, StaffInvitationResult } from './tenant.types';

const INVITATION_EXPIRY_MINUTES = 10;

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
  ) {}

  getCurrentTenantContext(user: AuthenticatedUser) {
    return {
      tenantId: user.tenantId,
      userId: user.id,
      membershipId: user.membershipId,
      role: user.role,
      permissions: user.permissions,
      storeIds: user.storeIds,
      allStoreAccess: user.allStoreAccess,
    };
  }

  async inviteStaff(
    actor: AuthenticatedUser,
    input: InviteStaffRequest,
  ): Promise<StaffInvitationResult> {
    await this.entitlementService.assertCanInviteStaff(actor);

    const role = await this.prisma.role.findFirst({
      where: { id: input.roleId, tenantId: actor.tenantId },
      select: { id: true, name: true },
    });
    if (!role) {
      throw new NotFoundException('The specified role was not found in this tenant.');
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    const existingMembership = await this.prisma.membership.findFirst({
      where: { tenantId: actor.tenantId, user: { email: normalizedEmail } },
      select: { id: true },
    });
    if (existingMembership) {
      throw new ConflictException(
        'This email address already has a membership in this tenant.',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MINUTES * 60 * 1000);

    const invitation = await this.prisma.$transaction(async (tx) => {
      // Invalidate any still-pending invitations for the same email in this tenant
      await tx.membershipInvitation.updateMany({
        where: {
          tenantId: actor.tenantId,
          email: normalizedEmail,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { expiresAt: new Date() },
      });

      const created = await tx.membershipInvitation.create({
        data: {
          tenantId: actor.tenantId,
          email: normalizedEmail,
          roleId: role.id,
          token,
          expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'staff.invitation_created',
          resource: 'membership-invitation',
          resourceId: created.id,
          metadata: { email: normalizedEmail, roleId: role.id, roleName: role.name },
        },
      });

      return created;
    });

    return {
      invitationId: invitation.id,
      email: normalizedEmail,
      role: role.name,
      expiresAt: invitation.expiresAt,
    };
  }

  async listStaff(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId, status: { in: ['ACTIVE', 'INVITED'] } },
      include: {
        user: { select: { id: true, email: true, name: true, status: true } },
        roles: {
          include: { role: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      select: { id: true, name: true, description: true, isSystem: true },
      orderBy: { name: 'asc' },
    });
  }
}