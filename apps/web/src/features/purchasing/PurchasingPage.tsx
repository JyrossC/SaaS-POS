import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Badge } from '../../components/ui/Badge';
import {
  useSuppliers,
  useCreateSupplier,
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useApprovePurchaseOrder,
  useReceiveGoods,
  useStores,
  useProducts,
} from '../../hooks/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../components/auth/AuthProvider';

interface POItemInput {
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: string;
  unitCost: string;
}

interface GRItemInput {
  productId: string;
  productName: string;
  sku: string;
  quantityReceived: string;
  unitCost: string;
}

export function PurchasingPage() {
  const { hasPermission } = useAuth();
  const canCreateSupplier = hasPermission('purchases.create');
  const canCreatePurchaseOrder = canCreateSupplier
    && hasPermission('stores.view')
    && hasPermission('products.view');
  const canReceiveGoods = canCreateSupplier;
  const canApprovePurchaseOrder = hasPermission('purchases.approve');
  const { data: suppliers, isLoading: suppliersLoading, isError: suppliersError, error: suppliersErrorValue } = useSuppliers();
  const { data: pos, isLoading: posLoading, isError: posError, error: posErrorValue } = usePurchaseOrders();
  const storesQuery = useStores(undefined, canCreatePurchaseOrder);
  const productsQuery = useProducts(undefined, canCreatePurchaseOrder);
  const stores = storesQuery.data;
  const products = productsQuery.data;
  const createSupplier = useCreateSupplier();
  const createPO = useCreatePurchaseOrder();
  const approvePO = useApprovePurchaseOrder();
  const receiveGoods = useReceiveGoods();

  const [newSupplier, setNewSupplier] = useState({ name: '', contactName: '', email: '', phone: '', address: '' });
  const [poStoreId, setPoStoreId] = useState('');
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [items, setItems] = useState<POItemInput[]>([
    { productId: '', productName: '', sku: '', quantityOrdered: '1', unitCost: '0' },
  ]);

  // Goods receipt state
  const [grPoId, setGrPoId] = useState('');
  const [grStoreId, setGrStoreId] = useState('');
  const [grItems, setGrItems] = useState<GRItemInput[]>([]);

  const handleAddItem = () => {
    setItems([...items, { productId: '', productName: '', sku: '', quantityOrdered: '1', unitCost: '0' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const selectPurchaseOrder = (purchaseOrderId: string) => {
    const purchaseOrder = pos?.items.find((order: any) => order.id === purchaseOrderId);
    setGrPoId(purchaseOrderId);
    setGrStoreId(purchaseOrder?.storeId ?? '');
    setGrItems((purchaseOrder?.items ?? []).map((item: any) => ({
      productId: item.productId,
      productName: item.product?.name ?? 'Unknown product',
      sku: item.product?.sku ?? '—',
      quantityReceived: String(item.quantityOrdered),
      unitCost: String(item.unitCost),
    })));
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPO.mutateAsync({
        storeId: poStoreId,
        supplierId: poSupplierId,
        items: items.map((i) => ({
          productId: i.productId,
          quantityOrdered: i.quantityOrdered,
          unitCost: i.unitCost,
        })),
        notes: poNotes || null,
      });
      toast.success('Purchase order created');
      setPoStoreId('');
      setPoSupplierId('');
      setPoNotes('');
      setItems([{ productId: '', productName: '', sku: '', quantityOrdered: '1', unitCost: '0' }]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create PO');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approvePO.mutateAsync(id);
      toast.success('PO approved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve PO');
    }
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grPoId || !grStoreId || !grItems.length ||
      grItems.some((item) => !Number.isFinite(Number(item.quantityReceived)) || Number(item.quantityReceived) <= 0)) {
      toast.error('Select an approved purchase order and enter positive quantities.');
      return;
    }
    try {
      await receiveGoods.mutateAsync({
        storeId: grStoreId,
        purchaseOrderId: grPoId || null,
        items: grItems.map((i) => ({
          productId: i.productId,
          quantityReceived: i.quantityReceived,
          unitCost: i.unitCost,
        })),
      });
      toast.success('Goods received and inventory updated');
      setGrPoId('');
      setGrStoreId('');
      setGrItems([]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to receive goods');
    }
  };

  const loading = suppliersLoading || posLoading || storesQuery.isLoading || productsQuery.isLoading;
  if (loading) return <LoadingState message="Loading purchasing data..." />;
  if (
    suppliersError ||
    posError ||
    (canCreatePurchaseOrder && (storesQuery.isError || productsQuery.isError)) ||
    !suppliers ||
    !pos ||
    (canCreatePurchaseOrder && (!stores || !products))
  ) {
    const requestError = suppliersErrorValue ?? posErrorValue ?? storesQuery.error ?? productsQuery.error;
    return (
      <ErrorState
        title="Could not load purchasing data"
        description={requestError instanceof Error ? requestError.message : 'Try again in a moment.'}
      />
    );
  }

  const storeOptions = stores?.items ?? [];
  const productOptions = products?.items ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-heading-h1 text-primary">Purchasing</h1>

      {(canCreatePurchaseOrder || canCreateSupplier) && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canCreatePurchaseOrder && <Card className="col-span-1 lg:col-span-2 p-6">
          <h2 className="text-heading-h4 text-primary mb-6">Create Purchase Order</h2>
          <form onSubmit={handleCreatePO} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={poStoreId}
                onChange={(e) => setPoStoreId(e.target.value)}
                required
                className="input w-full"
              >
                <option value="">Select store</option>
                {storeOptions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <select
                value={poSupplierId}
                onChange={(e) => setPoSupplierId(e.target.value)}
                required
                className="input w-full"
              >
                <option value="">Select supplier</option>
                {suppliers.items.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="col-span-2">
                <Input
                  label="Notes"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="border border-default rounded-lg p-4 mb-4">
              <h3 className="text-title-md text-primary mb-3">Items</h3>
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start mb-3">
                  <select
                    value={item.productId}
                    onChange={(e) => {
                      const selected = productOptions.find((p: any) => p.id === e.target.value);
                      const n = [...items];
                      setItems((current) => current.map((item, itemIndex) => itemIndex === index
                        ? {
                            ...item,
                            productId: e.target.value,
                            sku: selected?.sku || '',
                            productName: selected?.name || '',
                          }
                        : item));
                    }}
                    className="w-48"
                    required
                  >
                    <option value="">Select product</option>
                    {productOptions.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    label="SKU"
                    value={item.sku}
                    readOnly
                    className="w-40"
                  />
                  <Input
                    label="Name"
                    value={item.productName}
                    readOnly
                    className="w-64"
                  />
                  <Input
                    label="Qty"
                    type="number"
                    value={item.quantityOrdered}
                    onChange={(e) => {
                      const n = [...items]; n[index].quantityOrdered = e.target.value; setItems(n);
                    }}
                    className="w-24"
                  />
                  <Input
                    label="Unit Cost"
                    type="number"
                    step="0.01"
                    value={item.unitCost}
                    onChange={(e) => {
                      const n = [...items]; n[index].unitCost = e.target.value; setItems(n);
                    }}
                    className="w-32"
                  />
                  <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveItem(index)} disabled={items.length === 1}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                + Add Item
              </Button>
            </div>

            <Button type="submit" variant="primary" size="lg" isLoading={createPO.isPending} className="w-full" disabled={createPO.isPending}>
              Create Purchase Order
            </Button>
          </form>
        </Card>}

        {canCreateSupplier && (
        <Card className="col-span-1 lg:col-span-1 p-6 h-full">
          <h2 className="text-heading-h4 text-primary mb-6">Supplier</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await createSupplier.mutateAsync(newSupplier);
              setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '' });
              toast.success('Supplier added.');
            } catch (requestError) {
              toast.error(requestError instanceof Error ? requestError.message : 'Could not add supplier.');
            }
          }} className="space-y-4">
            <Input label="Name" value={newSupplier.name} onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})} required />
            <Input label="Contact Name" value={newSupplier.contactName} onChange={(e) => setNewSupplier({...newSupplier, contactName: e.target.value})} />
            <Input label="Email" type="email" value={newSupplier.email} onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})} />
            <Input label="Phone" value={newSupplier.phone} onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})} />
            <Input label="Address" value={newSupplier.address} onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})} />
            <Button type="submit" variant="primary" size="md" isLoading={createSupplier.isPending} className="w-full">
              Add Supplier
            </Button>
          </form>
        </Card>
        )}
      </div>}

      {canReceiveGoods && <Card className="p-6">
        <h2 className="text-heading-h4 text-primary mb-6">Goods Receipt (Receive Inventory)</h2>
        <p className="text-body-sm text-muted mb-4">Receive goods against an approved purchase order. Inventory will be updated automatically.</p>
        <form onSubmit={handleReceiveGoods} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={grPoId}
              onChange={(e) => selectPurchaseOrder(e.target.value)}
              required
              className="input w-full"
            >
              <option value="">Select an approved purchase order</option>
              {pos.items
                .filter((po: any) => po.status === 'APPROVED')
                .map((po: any) => (
                  <option key={po.id} value={po.id}>
                    {po.orderNumber} - {po.supplier?.name || 'Unknown Supplier'}
                  </option>
                ))}
            </select>
              <div className="form-field">
                <span className="text-label-md text-muted">Receiving store</span>
                <div className="input" aria-live="polite">
                  {pos.items.find((order: any) => order.id === grPoId)?.store?.name ?? 'Choose a purchase order first'}
                </div>
              </div>
          </div>

          <div className="border border-default rounded-lg p-4 mb-4">
            <h3 className="text-title-md text-primary mb-3">Received Items</h3>
            {grItems.map((item, index) => (
              <div key={item.productId} className="form-grid mb-3">
                <Input label="Product" value={`${item.sku} · ${item.productName}`} readOnly />
                <Input
                  label="Qty Received"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={item.quantityReceived}
                  onChange={(e) => {
                    setGrItems((current) => current.map((line, lineIndex) => lineIndex === index
                      ? { ...line, quantityReceived: e.target.value }
                      : line));
                  }}
                  required
                />
                <Input
                  label="Unit Cost (TZS)"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={item.unitCost}
                  onChange={(e) => {
                    setGrItems((current) => current.map((line, lineIndex) => lineIndex === index
                      ? { ...line, unitCost: e.target.value }
                      : line));
                  }}
                  required
                />
              </div>
            ))}
            {!grItems.length && <p className="text-body-sm text-muted">Select an approved purchase order to load its products.</p>}
          </div>

          <Button type="submit" variant="primary" size="lg" isLoading={receiveGoods.isPending} className="w-full" disabled={receiveGoods.isPending}>
            Receive Goods
          </Button>
        </form>
      </Card>}

      <Card className="p-6">
        <h2 className="text-heading-h4 text-primary mb-6">Purchase Orders</h2>
        <div className="flex justify-between items-center mb-4">
          <div>
            <Badge variant={pos.items.length === 0 ? 'danger' : 'success'}>
              {pos.items.length} orders
            </Badge>
          </div>
        </div>
        {pos.items.length === 0 ? (
          <EmptyState title="No purchase orders" description="Create your first purchase order." />
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Store</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.items.map((po: any) => (
                <tr key={po.id}>
                  <td className="font-mono text-sm">{po.orderNumber}</td>
                  <td>{po.store?.name || '—'}</td>
                  <td>{po.supplier?.name || '—'}</td>
                  <td>
                    <Badge variant={po.status === 'APPROVED' ? 'success' : po.status === 'DRAFT' ? 'warning' : 'danger'}>
                      {po.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {po.status === 'DRAFT' && canApprovePurchaseOrder && (
                        <Button type="button" variant="outline" size="sm" onClick={() => handleApprove(po.id)} disabled={approvePO.isPending}>
                          Approve
                        </Button>
                      )}
                      {po.status === 'APPROVED' && canReceiveGoods && (
                        <Button type="button" variant="outline" size="sm" onClick={() => selectPurchaseOrder(po.id)}>
                          Receive Goods
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
