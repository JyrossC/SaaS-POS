import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import {
  useAdjustStock,
  useProducts,
  useStoreInventory,
  useStores,
} from '../../hooks/api';

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `stock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function InventoryPage() {
  const { hasPermission } = useAuth();
  const [storeId, setStoreId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantityDelta, setQuantityDelta] = useState('');
  const [reason, setReason] = useState('');
  const canAdjust = hasPermission('inventory.adjust') && hasPermission('products.view');
  const storesQuery = useStores({ status: 'ACTIVE', page: 1, pageSize: 100 });
  const productsQuery = useProducts({ page: 1, pageSize: 100 }, canAdjust);
  const inventoryQuery = useStoreInventory(storeId);
  const adjustStock = useAdjustStock();

  const loading = storesQuery.isLoading || productsQuery.isLoading || (Boolean(storeId) && inventoryQuery.isLoading);
  const queryError = storesQuery.error ?? (canAdjust ? productsQuery.error : undefined) ?? inventoryQuery.error;
  const onHandByProduct = useMemo(
    () => new Map((inventoryQuery.data ?? []).map((item) => [item.product.id, item.quantityOnHand])),
    [inventoryQuery.data],
  );

  if (loading) return <LoadingState message="Loading inventory..." />;
  if (queryError) {
    return (
      <ErrorState
        title="Could not load inventory"
        description={queryError instanceof Error ? queryError.message : 'Try again in a moment.'}
      />
    );
  }

  const stores = storesQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!storeId) {
      toast.error('Select a store before adjusting stock.');
      return;
    }
    try {
      await adjustStock.mutateAsync({
        storeId,
        productId,
        quantityDelta,
        reason: reason.trim(),
        idempotencyKey: createIdempotencyKey(),
      });
      setProductId('');
      setQuantityDelta('');
      setReason('');
      toast.success('Stock adjustment recorded.');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not adjust stock.');
    }
  };

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div>
          <p className="text-overline text-brand">Stock control</p>
          <h1 className="text-heading-h1">Inventory</h1>
          <p className="text-body-sm text-muted">Review on-hand quantities and record audited adjustments.</p>
        </div>
        <label className="store-picker">
          <span className="text-label-md text-muted">Store</span>
          <select
            className="input"
            aria-label="Store"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
          >
            <option value="">Choose a store</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}
          </select>
        </label>
      </header>

      {stores.length === 0 ? (
        <EmptyState
          title="Create a store to begin"
          description="Inventory balances are tracked separately for each active store."
          action={<Link className="text-brand" to="/app/stores">Manage stores</Link>}
        />
      ) : !storeId ? (
        <EmptyState title="Select a store" description="Choose a store to see its current inventory." />
      ) : (
        <>
          {canAdjust && (
            <section className="surface-section">
              <div className="section-heading">
                <h2 className="text-heading-h4">Adjust stock</h2>
                <p className="text-body-sm text-muted">Positive quantities add stock; negative quantities remove it.</p>
              </div>
              <form className="form-grid" onSubmit={submitAdjustment}>
                <label className="form-field">
                  <span className="text-label-md text-muted">Product</span>
                  <select
                    className="input"
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                    required
                  >
                    <option value="">Choose a product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Quantity change"
                  type="number"
                  step="0.0001"
                  value={quantityDelta}
                  onChange={(event) => setQuantityDelta(event.target.value)}
                  hint="Enter a positive or negative amount."
                  required
                />
                <Input
                  label="Reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  required
                />
                <div className="form-actions">
                  <Button type="submit" isLoading={adjustStock.isPending} disabled={!productId}>
                    Record adjustment
                  </Button>
                </div>
              </form>
            </section>
          )}

          <section className="surface-section">
            <div className="section-heading">
              <h2 className="text-heading-h4">On-hand stock</h2>
              <p className="text-body-sm text-muted">{inventoryQuery.data?.length ?? 0} stocked products</p>
            </div>
            {!inventoryQuery.data?.length ? (
              <EmptyState
                title="No stock recorded for this store"
                description={canAdjust
                  ? 'Create products and receive or adjust stock to populate inventory.'
                  : 'Ask an inventory manager to receive or adjust stock.'}
              />
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr><th>SKU</th><th>Product</th><th>Unit</th><th className="text-right">On hand</th></tr>
                  </thead>
                  <tbody>
                    {inventoryQuery.data.map((item) => (
                      <tr key={item.id}>
                        <td className="font-mono">{item.product.sku}</td>
                        <td>{item.product.name}</td>
                        <td>{item.product.baseUnit}</td>
                        <td className="text-right font-mono">{item.quantityOnHand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
