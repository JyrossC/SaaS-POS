import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Badge } from '../../components/ui/Badge';
import { useSales, useCreateReturn } from '../../hooks/api';
import { toast } from 'react-hot-toast';

interface ReturnItemInput {
  saleItemId: string;
  productName: string;
  sku: string;
  quantity: string;
  maxQuantity: number;
}

export function ReturnsPage() {
  const { data: sales, isLoading } = useSales();
  const createReturn = useCreateReturn();

  const [saleId, setSaleId] = useState('');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<ReturnItemInput[]>([]);
  const [selectedSaleItems, setSelectedSaleItems] = useState<any[]>([]);

  const handleAddItem = () => {
    if (!selectedSaleItems.length) return;
    const newItem = selectedSaleItems[0];
    setItems([...items, {
      saleItemId: newItem.id,
      productName: newItem.product?.name || 'Unknown',
      sku: newItem.product?.sku || '—',
      quantity: '1',
      maxQuantity: Number(newItem.quantity) - Number(newItem.quantityRefunded || 0),
    }]);
    setSelectedSaleItems([]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, value: string) => {
    const n = [...items];
    n[index].quantity = value;
    setItems(n);
  };

  const handleSaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSaleId(id);
    if (!id) {
      setSelectedSaleItems([]);
      setItems([]);
      return;
    }
    const sale = sales?.items.find((s: any) => s.id === id);
    if (sale) {
      setSelectedSaleItems(sale.items.filter((si: any) => {
        const remaining = Number(si.quantity) - Number(si.quantityRefunded || 0);
        return remaining > 0;
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleId) {
      toast.error('Please select a sale');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item to return');
      return;
    }
    if (!reason) {
      toast.error('Please provide a reason');
      return;
    }
    try {
      await createReturn.mutateAsync({
        saleId,
        reason,
        items: items.map((i) => ({
          saleItemId: i.saleItemId,
          quantity: i.quantity,
        })),
      });
      toast.success('Return processed');
      setSaleId('');
      setReason('');
      setItems([]);
      setSelectedSaleItems([]);
    } catch (e: any) {
      toast.error(e.message || 'Failed to process return');
    }
  };

  if (isLoading) return <LoadingState message="Loading returns..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-heading-h1 text-primary">Returns & Refunds</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 p-6">
          <h2 className="text-heading-h4 text-primary mb-6">Process Return</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="col-span-2">
            <select
              value={saleId}
              onChange={handleSaleChange}
              required
              className="input w-full"
            >
                <option value="">Select a sale</option>
                {sales?.items.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.saleNumber} - {s.store?.name || 'Unknown Store'} - {new Date(s.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />

            {selectedSaleItems.length > 0 && (
              <div className="border border-default rounded-lg p-4 mb-4">
                <h3 className="text-title-md text-primary mb-3">Sale Items</h3>
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty Sold</th>
                      <th>Qty Refunded</th>
                      <th>Available</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSaleItems.map((si: any) => {
                      const remaining = Number(si.quantity) - Number(si.quantityRefunded || 0);
                      return (
                        <tr key={si.id}>
                          <td className="font-mono text-sm">{si.product?.name || 'Unknown'}</td>
                          <td className="font-mono text-sm">{si.product?.sku || '—'}</td>
                          <td className="font-mono tabular-nums text-sm">{si.quantity}</td>
                          <td className="font-mono tabular-nums text-sm">{si.quantityRefunded || 0}</td>
                          <td className="font-mono tabular-nums text-sm text-warning">{remaining}</td>
                          <td>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddItem()}
                              disabled={remaining <= 0}
                            >
                              Add to Return
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {items.length > 0 && (
              <div className="border border-default rounded-lg p-4 mb-4">
                <h3 className="text-title-md text-primary mb-3">Return Items</h3>
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start mb-3">
                    <Input
                      label="Sale Item ID"
                      value={item.saleItemId}
                      className="w-48"
                    />
                    <Input
                      label="SKU"
                      value={item.sku}
                      className="w-40"
                    />
                    <Input
                      label="Product Name"
                      value={item.productName}
                      className="w-64"
                    />
                    <Input
                      label="Qty"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      required
                      className="w-24"
                    />
                    <span className="text-body-sm text-muted ml-2">max {item.maxQuantity}</span>
                    <Button variant="danger" size="sm" onClick={() => handleRemoveItem(index)} disabled={items.length === 1}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" isLoading={createReturn.isPending} className="w-full" disabled={createReturn.isPending || items.length === 0}>
              Process Refund
            </Button>
          </form>
        </Card>

        <Card className="col-span-1 lg:col-span-1 p-6 h-full">
          <h2 className="text-heading-h4 text-primary mb-6">Return History</h2>
          {/* Returns history would be loaded from a separate endpoint; showing empty state for now */}
          <EmptyState title="No returns" description="Process your first return." />
        </Card>
      </div>
    </div>
  );
}
