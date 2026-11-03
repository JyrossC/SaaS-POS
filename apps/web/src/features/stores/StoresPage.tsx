import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { useCreateStore, useStores, useUpdateStore } from '../../hooks/api';

export function StoresPage() {
  const { hasPermission } = useAuth();
  const { data, isLoading, isError, error } = useStores({ page: 1, pageSize: 100 });
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const [form, setForm] = useState({ name: '', code: '', location: '' });

  if (isLoading) return <LoadingState message="Loading stores..." />;
  if (isError) {
    return (
      <ErrorState
        title="Could not load stores"
        description={error instanceof Error ? error.message : 'Try again in a moment.'}
      />
    );
  }

  const stores = data?.items ?? [];
  const canCreate = hasPermission('stores.create');
  const canUpdate = hasPermission('stores.update');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createStore.mutateAsync({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        location: form.location.trim() || null,
      });
      setForm({ name: '', code: '', location: '' });
      toast.success('Store created.');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not create store.');
    }
  };

  const toggleStatus = async (storeId: string, status: 'ACTIVE' | 'INACTIVE') => {
    try {
      await updateStore.mutateAsync({ storeId, body: { status } });
      toast.success(status === 'ACTIVE' ? 'Store activated.' : 'Store deactivated.');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not update store.');
    }
  };

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div>
          <p className="text-overline text-brand">Business administration</p>
          <h1 className="text-heading-h1">Stores</h1>
          <p className="text-body-sm text-muted">Manage the locations attached to your tenant.</p>
        </div>
      </header>

      {canCreate && (
        <section className="surface-section">
          <div className="section-heading">
            <h2 className="text-heading-h4">Add a store</h2>
            <p className="text-body-sm text-muted">Store codes are unique within your business.</p>
          </div>
          <form onSubmit={submit} className="form-grid">
            <Input
              label="Store name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              maxLength={200}
              required
            />
            <Input
              label="Store code"
              value={form.code}
              onChange={(event) => setForm((current) => ({
                ...current,
                code: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
              }))}
              maxLength={32}
              pattern="[A-Z0-9]+(?:-[A-Z0-9]+)*"
              hint="Use uppercase letters, numbers, and hyphens."
              required
            />
            <Input
              label="Location"
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              maxLength={500}
            />
            <div className="form-actions">
              <Button type="submit" isLoading={createStore.isPending}>
                Create store
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className="surface-section">
        <div className="section-heading">
          <h2 className="text-heading-h4">Your stores</h2>
          <p className="text-body-sm text-muted">
            {data?.total ?? stores.length} {data?.total === 1 ? 'location' : 'locations'}
          </p>
        </div>
        {stores.length === 0 ? (
          <EmptyState
            title="No stores yet"
            description={canCreate
              ? 'Create your first store before setting up inventory, purchasing, or checkout.'
              : 'Ask a tenant administrator to add a store.'}
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Code</th>
                  <th>Location</th>
                  <th>Status</th>
                  {canUpdate && <th className="text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td>{store.name}</td>
                    <td className="font-mono">{store.code}</td>
                    <td>{store.location || '—'}</td>
                    <td>
                      <span className={`status-label ${store.status === 'ACTIVE' ? 'status-success' : 'status-muted'}`}>
                        {store.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canUpdate && (
                      <td className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateStore.isPending}
                          onClick={() => toggleStatus(store.id, store.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                        >
                          {store.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
