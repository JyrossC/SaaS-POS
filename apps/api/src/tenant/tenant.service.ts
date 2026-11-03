import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { EntitlementService } from '../subscription/entitlement.service';
import {
  CreateTenantRoleRequest,
  InviteStaffRequest,
  StaffInvitationResult,
  UpdateBusinessSettingsRequest,
  UpdateTenantRoleRequest,
} from './tenant.types';

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

  async getBusinessSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        businessType: true,
        businessAddress: true,
        contactEmail: true,
        contactPhone: true,
        currency: true,
        timezone: true,
        taxEnabled: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant settings were not found.');
    }
    return {
      ...tenant,
      taxStatus: tenant.taxEnabled ? 'ENABLED' as const : 'DISABLED_PENDING_REVIEW' as const,
      receiptSettingsStatus: 'PENDING_LEGAL_REVIEW' as const,
      notificationSettingsStatus: 'NOT_CONFIGURED' as const,
      integrationsStatus: 'NOT_CONFIGURED' as const,
    };
  }

  async updateBusinessSettings(
    actor: AuthenticatedUser,
    input: UpdateBusinessSettingsRequest,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.tenant.findUnique({
        where: { id: actor.tenantId },
        select: {
          name: true,
          businessAddress: true,
          contactEmail: true,
          contactPhone: true,
          currency: true,
          timezone: true,
          taxEnabled: true,
        },
      });
      if (!before) {
        throw new NotFoundException('Tenant settings were not found.');
      }

      const after = await tx.tenant.update({
        where: { id: actor.tenantId },
        data: {
          name: input.name.trim(),
          businessAddress: input.businessAddress?.trim() || null,
          contactEmail: input.contactEmail?.trim().toLowerCase() || null,
          contactPhone: input.contactPhone?.trim() || null,
        },
        select: {
          id: true,
          name: true,
          businessType: true,
          businessAddress: true,
          contactEmail: true,
          contactPhone: true,
          currency: true,
          timezone: true,
          taxEnabled: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'business_settings.updated',
          resource: 'tenant_business_settings',
          resourceId: actor.tenantId,
          metadata: {
            before,
            after: {
              name: after.name,
              businessAddress: after.businessAddress,
              contactEmail: after.contactEmail,
              contactPhone: after.contactPhone,
              currency: after.currency,
              timezone: after.timezone,
              taxEnabled: after.taxEnabled,
            },
          },
        },
      });

      return {
        ...after,
        taxStatus: after.taxEnabled ? 'ENABLED' as const : 'DISABLED_PENDING_REVIEW' as const,
        receiptSettingsStatus: 'PENDING_LEGAL_REVIEW' as const,
        notificationSettingsStatus: 'NOT_CONFIGURED' as const,
        integrationsStatus: 'NOT_CONFIGURED' as const,
      };
    });
  }

  async inviteStaff(
    actor: AuthenticatedUser,
    input: InviteStaffRequest,
  ): Promise<StaffInvitationResult> {
    await this.entitlementService.assertCanInviteStaff(actor);

    const role = await this.prisma.role.findFirst({
      where: { id: input.roleId, tenantId: actor.tenantId },
      select: {
        id: true,
        name: true,
        permissions: { select: { permission: { select: { code: true } } } },
      },
    });
    if (!role) {
      throw new NotFoundException('The specified role was not found in this tenant.');
    }
    const rolePermissions = role.permissions.map(({ permission }) => permission.code);
    if (rolePermissions.some((permission) => !actor.permissions.includes(permission))) {
      throw new ForbiddenException('You cannot invite staff into a role with permissions you do not hold.');
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
      where: { tenantId, status: { in: ['ACTIVE', 'INVITED', 'SUSPENDED'] } },
      include: {
        user: { select: { id: true, email: true, name: true, status: true } },
        roles: {
          include: { role: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deactivateStaff(actor: AuthenticatedUser, membershipId: string) {
    if (membershipId === actor.membershipId) {
      throw new ConflictException('You cannot deactivate your own tenant membership.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM "Tenant" WHERE id = $1 FOR UPDATE',
        actor.tenantId,
      );
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, tenantId: actor.tenantId },
        include: {
          roles: { include: { role: { select: { name: true } } } },
        },
      });
      if (!membership) {
        throw new NotFoundException('The specified staff membership was not found in this tenant.');
      }
      if (membership.status !== 'ACTIVE') {
        throw new ConflictException('Only active tenant memberships can be deactivated.');
      }

      const isTenantOwner = membership.roles.some(({ role }) => role.name === 'Tenant Owner');
      if (isTenantOwner) {
        const activeOwnerCount = await tx.membership.count({
          where: {
            tenantId: actor.tenantId,
            status: 'ACTIVE',
            roles: { some: { role: { name: 'Tenant Owner' } } },
          },
        });
        if (activeOwnerCount <= 1) {
          throw new ConflictException('The last active tenant owner cannot be deactivated.');
        }
      }

      const now = new Date();
      const updated = await tx.membership.updateMany({
        where: { id: membership.id, tenantId: actor.tenantId, status: 'ACTIVE' },
        data: { status: 'SUSPENDED' },
      });
      if (updated.count !== 1) {
        throw new ConflictException('The tenant membership is no longer active.');
      }

      await tx.authSession.updateMany({
        where: { membershipId: membership.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'staff.membership_deactivated',
          resource: 'membership',
          resourceId: membership.id,
          metadata: { targetUserId: membership.userId },
        },
      });

      return { membershipId: membership.id, status: 'SUSPENDED' as const };
    });
  }

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
          select: { permission: { select: { code: true } } },
          orderBy: { permission: { code: 'asc' } },
        },
        _count: { select: { memberships: true, invitations: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listAssignablePermissions(actor: AuthenticatedUser) {
    return this.prisma.permission.findMany({
      where: { code: { in: actor.permissions } },
      select: { code: true, description: true },
      orderBy: { code: 'asc' },
    });
  }

  async createRole(actor: AuthenticatedUser, input: CreateTenantRoleRequest) {
    const permissionCodes = input.permissionCodes ?? [];
    if (permissionCodes.length > 0 && !actor.permissions.includes('roles.assign_permissions')) {
      throw new ForbiddenException('You do not have permission to assign role permissions.');
    }
    const permissions = await this.resolveAssignablePermissions(actor, permissionCodes);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.create({
          data: {
            tenantId: actor.tenantId,
            name: input.name,
            description: input.description || null,
          },
          select: { id: true },
        });
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
          });
        }
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            actorMembershipId: actor.membershipId,
            actorUserId: actor.id,
            action: 'roles.created',
            resource: 'role',
            resourceId: role.id,
            metadata: { name: input.name, permissionCodes },
          },
        });
        return tx.role.findUniqueOrThrow({
          where: { id: role.id },
          select: {
            id: true,
            name: true,
            description: true,
            isSystem: true,
            permissions: { select: { permission: { select: { code: true } } } },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A role with this name already exists in this tenant.');
      }
      throw error;
    }
  }

  async updateRole(
    actor: AuthenticatedUser,
    roleId: string,
    input: UpdateTenantRoleRequest,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId: actor.tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: { select: { permission: { select: { code: true } } } },
      },
    });
    if (!role) {
      throw new NotFoundException('The specified role was not found in this tenant.');
    }
    if (role.name === 'Tenant Owner') {
      throw new ConflictException('The Tenant Owner role cannot be modified.');
    }
    if (role.isSystem && (input.name !== undefined || input.description !== undefined)) {
      throw new ConflictException('Built-in role names and descriptions cannot be changed.');
    }

    const permissionCodes = input.permissionCodes;
    if (permissionCodes && !actor.permissions.includes('roles.assign_permissions')) {
      throw new ForbiddenException('You do not have permission to assign role permissions.');
    }
    const permissions = permissionCodes
      ? await this.resolveAssignablePermissions(actor, permissionCodes)
      : undefined;
    const currentPermissionCodes = role.permissions.map(({ permission }) => permission.code);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.role.update({
          where: { id: role.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description || null } : {}),
          },
        });
        if (permissions) {
          await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
          if (permissions.length > 0) {
            await tx.rolePermission.createMany({
              data: permissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
            });
          }
        }
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            actorMembershipId: actor.membershipId,
            actorUserId: actor.id,
            action: 'roles.updated',
            resource: 'role',
            resourceId: role.id,
            metadata: {
              before: {
                name: role.name,
                description: role.description,
                permissionCodes: currentPermissionCodes,
              },
              after: {
                name: input.name ?? role.name,
                description: input.description !== undefined ? input.description || null : role.description,
                permissionCodes: permissionCodes ?? currentPermissionCodes,
              },
            },
          },
        });
        return tx.role.findUniqueOrThrow({
          where: { id: role.id },
          select: {
            id: true,
            name: true,
            description: true,
            isSystem: true,
            permissions: { select: { permission: { select: { code: true } } } },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A role with this name already exists in this tenant.');
      }
      throw error;
    }
  }

  private async resolveAssignablePermissions(actor: AuthenticatedUser, permissionCodes: string[]) {
    if (permissionCodes.some((code) => !actor.permissions.includes(code))) {
      throw new ForbiddenException('You cannot assign permissions you do not hold.');
    }
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true, code: true },
    });
    if (permissions.length !== permissionCodes.length) {
      throw new BadRequestException('One or more requested permissions are unavailable.');
    }
    return permissions;
  }
}