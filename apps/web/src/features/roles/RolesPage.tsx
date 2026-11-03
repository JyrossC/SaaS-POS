import { FormEvent, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  AssignablePermission,
  TenantRole,
  useAssignablePermissions,
  useCreateTenantRole,
  useTenantRoles,
  useUpdateTenantRole,
} from '../../hooks/api';

interface RoleForm {
  name: string;
  description: string;
  permissionCodes: string[];
}

const emptyForm: RoleForm = { name: '', description: '', permissionCodes: [] };

function roleForm(role: TenantRole): RoleForm {
  return {
    name: role.name,
    description: role.description ?? '',
    permissionCodes: role.permissions.map(({ permission }) => permission.code),
  };
}

function PermissionChoices({
  permissions,
  selected,
  onChange,
}: {
  permissions: AssignablePermission[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-label-md text-secondary">Permissions</legend>
      <p className="text-body-sm text-muted">
        Only permissions your account currently holds can be assigned.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {permissions.map((permission) => {
          const checked = selected.includes(permission.code);
          return (
            <label key={permission.code} className="flex items-start gap-3 rounded-md border border-default p-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(
                  checked
                    ? selected.filter((code) => code !== permission.code)
                    : [...selected, permission.code],
                )}
              />
              <span>
                <span className="block font-mono text-body-sm text-primary">{permission.code}</span>
                {permission.description && (
                  <span className="block text-caption text-muted">{permission.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function RolesPage() {
  const { hasPermission } = useAuth();
  const rolesQuery = useTenantRoles();
  const permissionsQuery = useAssignablePermissions();
  const createRole = useCreateTenantRole();
  const updateRole = useUpdateTenantRole();
  const [newRole, setNewRole] = useState<RoleForm>(emptyForm);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RoleForm>(emptyForm);
  const canCreate = hasPermission('roles.create');
  const canUpdate = hasPermission('roles.update');
  const canAssignPermissions = hasPermission('roles.assign_permissions');

  if (rolesQuery.isLoading || permissionsQuery.isLoading) {
    return <LoadingState message="Loading roles and permissions..." />;
  }
  if (rolesQuery.isError || permissionsQuery.isError || !rolesQuery.data || !permissionsQuery.data) {
    const error = rolesQuery.error ?? permissionsQuery.error;
    return (
      <ErrorState
        title="Could not load role administration"
        description={error instanceof Error ? error.message : 'Try again in a moment.'}
      />
    );
  }

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createRole.mutateAsync({
        name: newRole.name.trim(),
        description: newRole.description.trim() || null,
        permissionCodes: canAssignPermissions ? newRole.permissionCodes : [],
      });
      setNewRole(emptyForm);
      toast.success('Role created.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create role.');
    }
  };

  const beginEdit = (role: TenantRole) => {
    setEditingRoleId(role.id);
    setEditForm(roleForm(role));
  };

  const submitEdit = async (event: FormEvent, role: TenantRole) => {
    event.preventDefault();
    const body: {
      name?: string;
      description?: string | null;
      permissionCodes?: string[];
    } = {};
    if (!role.isSystem) {
      body.name = editForm.name.trim();
      body.description = editForm.description.trim() || null;
    }
    if (canAssignPermissions) body.permissionCodes = editForm.permissionCodes;

    try {
      await updateRole.mutateAsync({ roleId: role.id, body });
      setEditingRoleId(null);
      toast.success('Role updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update role.');
    }
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="text-overline text-brand">Business administration</p>
          <h1 className="text-heading-h1">Roles &amp; permissions</h1>
          <p className="text-body-sm text-muted">
            Define tenant roles using only the permissions available to your account.
          </p>
        </div>
      </header>

      {canCreate && (
        <section className="surface-section">
          <div className="section-heading">
            <h2 className="text-heading-h4">Create a role</h2>
            <p className="text-body-sm text-muted">Roles are scoped to this business.</p>
          </div>
          <form onSubmit={submitCreate} className="form-grid">
            <Input
              label="Role name"
              value={newRole.name}
              onChange={(event) => setNewRole((current) => ({ ...current, name: event.target.value }))}
              minLength={2}
              maxLength={80}
              required
            />
            <Input
              label="Description"
              value={newRole.description}
              onChange={(event) => setNewRole((current) => ({ ...current, description: event.target.value }))}
              maxLength={500}
            />
            {canAssignPermissions && (
              <PermissionChoices
                permissions={permissionsQuery.data}
                selected={newRole.permissionCodes}
                onChange={(permissionCodes) => setNewRole((current) => ({ ...current, permissionCodes }))}
              />
            )}
            <div className="form-actions">
              <Button type="submit" isLoading={createRole.isPending}>Create role</Button>
            </div>
          </form>
        </section>
      )}

      <section className="surface-section">
        <div className="section-heading">
          <h2 className="text-heading-h4">Tenant roles</h2>
          <p className="text-body-sm text-muted">{rolesQuery.data.length} roles</p>
        </div>
        {rolesQuery.data.length === 0 ? (
          <EmptyState title="No roles found" description="Create a role to define scoped access for your team." />
        ) : (
          <div className="space-y-4">
            {rolesQuery.data.map((role) => {
              const isEditing = editingRoleId === role.id;
              const rolePermissionCodes = role.permissions.map(({ permission }) => permission.code);
              return (
                <article key={role.id} className="rounded-lg border border-default p-4">
                  {isEditing ? (
                    <form onSubmit={(event) => void submitEdit(event, role)} className="form-grid">
                      <Input
                        label="Role name"
                        value={editForm.name}
                        onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                        minLength={2}
                        maxLength={80}
                        required
                        disabled={role.isSystem}
                      />
                      <Input
                        label="Description"
                        value={editForm.description}
                        onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                        maxLength={500}
                        disabled={role.isSystem}
                      />
                      {canAssignPermissions && (
                        <PermissionChoices
                          permissions={permissionsQuery.data}
                          selected={editForm.permissionCodes}
                          onChange={(permissionCodes) => setEditForm((current) => ({ ...current, permissionCodes }))}
                        />
                      )}
                      <div className="form-actions">
                        <Button type="submit" isLoading={updateRole.isPending}>Save changes</Button>
                        <Button type="button" variant="outline" onClick={() => setEditingRoleId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-heading-h5 text-primary">{role.name}</h3>
                          <p className="text-body-sm text-muted">{role.description || 'No description'}</p>
                          <p className="text-caption text-muted">
                            {role.isSystem ? 'Built-in role' : 'Custom role'}
                            {role._count
                              ? ` · ${role._count.memberships} members · ${role._count.invitations} invitations`
                              : ''}
                          </p>
                        </div>
                        {canUpdate && role.name !== 'Tenant Owner' && (
                          <Button type="button" variant="outline" size="sm" onClick={() => beginEdit(role)}>
                            Edit role
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {rolePermissionCodes.length > 0
                          ? rolePermissionCodes.map((code) => (
                            <span key={code} className="rounded-full bg-subtle px-3 py-1 font-mono text-caption text-secondary">
                              {code}
                            </span>
                          ))
                          : <span className="text-body-sm text-muted">No permissions assigned</span>}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
