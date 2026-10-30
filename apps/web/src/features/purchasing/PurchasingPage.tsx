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
import { RequirePermissions } from '../../components/auth/AuthProvider';

interface POItemInput {
  productId: string;
  productName: string;
  sku: string;
  quantityOrdered: string;
  unitCost: string;
}

interface GRItemInput {
  productId: string;
  quantityReceived: string;
  unitCost: string;
}

export function PurchasingPage() {
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { data: pos, isLoading: posLoading } = usePurchaseOrders();
  const { data: stores, isLoading: storesLoading } = useStores();
  const { data: products, isLoading: productsLoading } = useProducts();
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
  const [grItems, setGrItems] = useState<GRItemInput[]>([
    { productId: '', quantityReceived: '1', unitCost: '0' },
  ]);

  const handleAddItem = () => {
    setItems([...items, { productId: '', productName: '', sku: '', quantityOrdered: '1', unitCost: '0' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddGRItem = () => {
    setGrItems([...grItems, { productId: '', quantityReceived: '1', unitCost: '0' }]);
  };

  const handleRemoveGRItem = (index: number) => {
    setGrItems(grItems.filter((_, i) => i !== index));
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
      setGrItems([{ productId: '', quantityReceived: '1', unitCost: '0' }]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to receive goods');
    }
  };

  const loading = suppliersLoading || posLoading || storesLoading || productsLoading;
  if (loading) return <LoadingState message="Loading purchasing data..." />;
  if (suppliers === undefined || pos === undefined || stores === undefined || products === undefined) {
    return <ErrorState title="Failed to load data" />;
  }

  const storeOptions = stores.items;
  const productOptions = products.items;

  return (
    <div className="space-y-6">
      <h1 className="text-heading-h1 text-primary">Purchasing</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 p-6">
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
                      n[index].productId = e.target.value;
                      n[index].sku = selected?.sku || '';
                      n[index].productName = selected?.name || '';
                      setItems(n);
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
                    onChange={(e) => {
                      const n = [...items]; n[index].sku = e.target.value; setItems(n);
                    }}
                    className="w-40"
                  />
                  <Input
                    label="Name"
                    value={item.productName}
                    onChange={(e) => {
                      const n = [...items]; n[index].productName = e.target.value; setItems(n);
                    }}
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
                  <Button variant="danger" size="sm" onClick={() => handleRemoveItem(index)} disabled={items.length === 1}>
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
        </Card>

        <Card className="col-span-1 lg:col-span-1 p-6 h-full">
          <h2 className="text-heading-h4 text-primary mb-6">Supplier</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            createSupplier.mutate(newSupplier);
            setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '' });
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
      </div>

      <Card className="p-6">
        <h2 className="text-heading-h4 text-primary mb-6">Goods Receipt (Receive Inventory)</h2>
        <p className="text-body-sm text-muted mb-4">Receive goods against an approved purchase order. Inventory will be updated automatically.</p>
        <form onSubmit={handleReceiveGoods} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={grPoId}
              onChange={(e) => setGrPoId(e.target.value)}
              required
              className="input w-full"
            >
              <option value="">Select PO</option>
              {pos.items
                .filter((po: any) => po.status === 'APPROVED')
                .map((po: any) => (
                  <option key={po.id} value={po.id}>
                    {po.orderNumber} - {po.supplier?.name || 'Unknown Supplier'}
                  </option>
                ))}
            </select>
              <select
                value={grStoreId}
                onChange={(e) => setGrStoreId(e.target.value)}
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
          </div>

          <div className="border border-default rounded-lg p-4 mb-4">
            <h3 className="text-title-md text-primary mb-3">Received Items</h3>
            {grItems.map((item, index) => (
              <div key={index} className="flex gap-3 items-start mb-3">
                <select
                  value={item.productId}
                  onChange={(e) => {
                    const n = [...grItems]; n[index].productId = e.target.value; setGrItems(n);
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
                  label="Qty Received"
                  type="number"
                  step="0.0001"
                  value={item.quantityReceived}
                  onChange={(e) => {
                    const n = [...grItems]; n[index].quantityReceived = e.target.value; setGrItems(n);
                  }}
                  className="w-32"
                  required
                />
                <Input
                  label="Unit Cost"
                  type="number"
                  step="0.01"
                  value={item.unitCost}
                  onChange={(e) => {
                    const n = [...grItems]; n[index].unitCost = e.target.value; setGrItems(n);
                  }}
                  className="w-32"
                  required
                />
                <Button variant="danger" size="sm" onClick={() => handleRemoveGRItem(index)} disabled={grItems.length === 1}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddGRItem}>
              + Add Item
            </Button>
          </div>

          <Button type="submit" variant="primary" size="lg" isLoading={receiveGoods.isPending} className="w-full" disabled={receiveGoods.isPending}>
            Receive Goods
          </Button>
        </form>
      </Card>

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
                      {po.status === 'DRAFT' && (
                        <Button variant="outline" size="sm" onClick={() => handleApprove(po.id)} disabled={approvePO.isPending}>
                          Approve
                        </Button>
                      )}
                      {po.status === 'APPROVED' && (
                        <Button variant="outline" size="sm" onClick={() => setGrPoId(po.id)}>
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
