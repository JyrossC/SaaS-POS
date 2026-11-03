import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../components/auth/AuthProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { formatBusinessDate } from '../../lib/formatters';
import {
  useActiveQuarantines,
  useBatches,
  useCreateBatch,
  useExpiringBatches,
  useProducts,
  useQuarantineStock,
  useReleaseQuarantine,
  useStores,
} from '../../hooks/api';

export function PharmacyPage() {
  const { hasPermission } = useAuth();
  const canManageBatches = hasPermission('pharmacy.batches.create')
    && hasPermission('stores.view')
    && hasPermission('products.view');
  const batchesQuery = useBatches();
  const expiringQuery = useExpiringBatches({ days: 30 });
  const quarantinesQuery = useActiveQuarantines();
  const storesQuery = useStores({ status: 'ACTIVE', page: 1, pageSize: 100 }, canManageBatches);
  const productsQuery = useProducts({ page: 1, pageSize: 100 }, canManageBatches);
  const createBatch = useCreateBatch();
  const quarantineStock = useQuarantineStock();
  const releaseQuarantine = useReleaseQuarantine();
  const [batch, setBatch] = useState({
    storeId: '',
    productId: '',
    batchNumber: '',
    quantityReceived: '',
    costPerUnit: '',
    expiresAt: '',
  });
  const [quarantine, setQuarantine] = useState({
    storeId: '',
    batchId: '',
    quantity: '',
    reason: '',
  });

  const queries = [
    batchesQuery,
    expiringQuery,
    quarantinesQuery,
    ...(canManageBatches ? [storesQuery, productsQuery] : []),
  ];
  if (queries.some((query) => query.isLoading)) {
    return <LoadingState message="Loading pharmacy stock..." />;
  }
  const failedQuery = queries.find((query) => query.error);
  if (failedQuery) {
    return (
      <ErrorState
        title="Could not load pharmacy stock"
        description={failedQuery.error instanceof Error ? failedQuery.error.message : 'Try again in a moment.'}
      />
    );
  }

  const stores = storesQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];
  const batches = batchesQuery.data ?? [];
  const expiringBatches = expiringQuery.data ?? [];
  const quarantines = quarantinesQuery.data ?? [];

  const submitBatch = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createBatch.mutateAsync({
        ...batch,
        quantityReceived: batch.quantityReceived,
        costPerUnit: batch.costPerUnit || null,
        expiresAt: new Date(batch.expiresAt).toISOString(),
      });
      setBatch({
        storeId: '',
        productId: '',
        batchNumber: '',
        quantityReceived: '',
        costPerUnit: '',
        expiresAt: '',
      });
      toast.success('Batch received and inventory updated.');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not receive batch.');
    }
  };

  const submitQuarantine = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await quarantineStock.mutateAsync(quarantine);
      setQuarantine({ storeId: '', batchId: '', quantity: '', reason: '' });
      toast.success('Stock quarantined.');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not quarantine stock.');
    }
  };

  const release = async (quarantineId: string) => {
    try {
      await releaseQuarantine.mutateAsync({ quarantineId });
      toast.success('Quarantined quantity released to available stock.');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not release quarantined stock.');
    }
  };

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div>
          <p className="text-overline text-brand">Stock control</p>
          <h1 className="text-heading-h1">Pharmacy inventory</h1>
          <p className="text-body-sm text-muted">Track batch expiry and manage quarantined quantities.</p>
        </div>
        <span className={`status-label ${expiringBatches.length ? 'status-warning' : 'status-success'}`}>
          {expiringBatches.length} batches expiring within 30 days
        </span>
      </header>

      <section className="surface-section compliance-gate" role="note">
        <p className="text-overline text-warning">Compliance approval required</p>
        <h2 className="text-heading-h4">Prescription and dispensing actions are not enabled.</h2>
        <p className="text-body-sm text-secondary">
          The documented Tanzania-specific medicine categories, prescriber authorization, records,
          retention, and recall rules must be approved before regulated workflows are offered.
        </p>
      </section>

      {canManageBatches && (
        <section className="surface-section">
          <div className="section-heading">
            <h2 className="text-heading-h4">Receive a batch</h2>
            <p className="text-body-sm text-muted">Receiving updates both batch and store inventory.</p>
          </div>
          <form className="form-grid" onSubmit={submitBatch}>
            <label className="form-field">
              <span className="text-label-md text-muted">Store</span>
              <select
                className="input"
                value={batch.storeId}
                onChange={(event) => setBatch((current) => ({ ...current, storeId: event.target.value }))}
                required
              >
                <option value="">Choose a store</option>
                {stores.map((store: any) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="text-label-md text-muted">Product</span>
              <select
                className="input"
                value={batch.productId}
                onChange={(event) => setBatch((current) => ({ ...current, productId: event.target.value }))}
                required
              >
                <option value="">Choose a product</option>
                {products.map((product: any) => (
                  <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>
                ))}
              </select>
            </label>
            <Input
              label="Batch number"
              value={batch.batchNumber}
              onChange={(event) => setBatch((current) => ({ ...current, batchNumber: event.target.value }))}
              required
            />
            <Input
              label="Quantity received"
              type="number"
              min="0.0001"
              step="0.0001"
              value={batch.quantityReceived}
              onChange={(event) => setBatch((current) => ({ ...current, quantityReceived: event.target.value }))}
              required
            />
            <Input
              label="Unit cost (TZS)"
              type="number"
              min="0"
              step="0.0001"
              value={batch.costPerUnit}
              onChange={(event) => setBatch((current) => ({ ...current, costPerUnit: event.target.value }))}
            />
            <Input
              label="Expiry"
              type="datetime-local"
              value={batch.expiresAt}
              onChange={(event) => setBatch((current) => ({ ...current, expiresAt: event.target.value }))}
              required
            />
            <div className="form-actions">
              <Button type="submit" isLoading={createBatch.isPending} disabled={!stores.length || !products.length}>
                Receive batch
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className="surface-section">
        <div className="section-heading">
          <h2 className="text-heading-h4">Batch register</h2>
          <p className="text-body-sm text-muted">{batches.length} batches</p>
        </div>
        {!batches.length ? (
          <EmptyState title="No batches recorded" description="Received batches will appear here." />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Batch</th><th>Product</th><th>Store balance</th><th>Expiry</th><th>Status</th></tr>
              </thead>
              <tbody>
                {batches.map((item) => {
                  const expired = new Date(item.expiresAt).getTime() < Date.now();
                  const expiringSoon = expiringBatches.some((expiring) => expiring.id === item.id);
                  return (
                    <tr key={item.id}>
                      <td className="font-mono">{item.batchNumber}</td>
                      <td>{item.product.sku} · {item.product.name}</td>
                      <td className="font-mono tabular-nums">
                        {item.inventory.reduce((sum, stock) => sum + Number(stock.quantityOnHand), 0).toFixed(4)}
                      </td>
                      <td>{formatBusinessDate(item.expiresAt)}</td>
                      <td>
                        <Badge variant={expired ? 'danger' : expiringSoon ? 'warning' : 'success'}>
                          {expired ? 'Expired' : expiringSoon ? 'Expiring soon' : 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManageBatches && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="surface-section">
            <div className="section-heading">
              <h2 className="text-heading-h4">Quarantine stock</h2>
              <p className="text-body-sm text-muted">Remove compromised stock from available inventory.</p>
            </div>
            <form className="form-stack" onSubmit={submitQuarantine}>
              <label className="form-field">
                <span className="text-label-md text-muted">Store</span>
                <select
                  className="input"
                  value={quarantine.storeId}
                  onChange={(event) => setQuarantine((current) => ({
                    ...current,
                    storeId: event.target.value,
                    batchId: '',
                  }))}
                  required
                >
                  <option value="">Choose a store</option>
                  {stores.map((store: any) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span className="text-label-md text-muted">Batch</span>
                <select
                  className="input"
                  value={quarantine.batchId}
                  onChange={(event) => setQuarantine((current) => ({ ...current, batchId: event.target.value }))}
                  disabled={!quarantine.storeId}
                  required
                >
                  <option value="">Choose a batch</option>
                  {batches.filter((item) => item.inventory.some((stock) =>
                    stock.storeId === quarantine.storeId && Number(stock.quantityOnHand) > 0,
                  )).map((item) => (
                    <option key={item.id} value={item.id}>{item.batchNumber} · {item.product.name}</option>
                  ))}
                </select>
              </label>
              <Input
                label="Quantity"
                type="number"
                min="0.0001"
                step="0.0001"
                value={quarantine.quantity}
                onChange={(event) => setQuarantine((current) => ({ ...current, quantity: event.target.value }))}
                required
              />
              <Input
                label="Reason"
                value={quarantine.reason}
                onChange={(event) => setQuarantine((current) => ({ ...current, reason: event.target.value }))}
                maxLength={500}
                required
              />
              <Button type="submit" variant="danger" isLoading={quarantineStock.isPending}>
                Quarantine quantity
              </Button>
            </form>
          </section>

          <section className="surface-section">
            <div className="section-heading">
              <h2 className="text-heading-h4">Active quarantine</h2>
              <p className="text-body-sm text-muted">Release restores the full quarantined quantity.</p>
            </div>
            {!quarantines.length ? (
              <EmptyState title="No active quarantines" description="Quarantined batch quantities will be listed here." />
            ) : (
              <div className="quarantine-list">
                {quarantines.map((item) => (
                  <article className="quarantine-item" key={item.id}>
                    <div>
                      <strong>{item.batch.batchNumber} · {item.batch.product.name}</strong>
                      <p className="text-body-sm text-muted">
                        {item.store.name} · {item.quantity} {item.batch.product.baseUnit} · {item.reason}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isLoading={releaseQuarantine.isPending}
                      onClick={() => void release(item.id)}
                    >
                      Release all
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
