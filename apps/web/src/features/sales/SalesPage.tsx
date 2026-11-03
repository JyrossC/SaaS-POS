import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Badge } from '../../components/ui/Badge';
import { useSales, useCreateSale, useStores, useProducts } from '../../hooks/api';
import { toast } from 'react-hot-toast';
import { formatTzs } from '../../lib/formatters';
import { useAuth } from '../../components/auth/AuthProvider';

interface SaleItemInput {
  productId: string;
  productName: string;
  sku: string;
  quantity: string;
  unitPrice: string;
}

interface PaymentInput {
  paymentMethod: string;
  amount: string;
  reference?: string;
}

export function SalesPage() {
  const { hasPermission } = useAuth();
  const canCreateSale = hasPermission('sales.create')
    && hasPermission('stores.view')
    && hasPermission('products.view');
  const { data, isLoading, isError, error } = useSales();
  const storesQuery = useStores(undefined, canCreateSale);
  const productsQuery = useProducts(undefined, canCreateSale);
  const stores = storesQuery.data;
  const products = productsQuery.data;
  const createSale = useCreateSale();

  const [items, setItems] = useState<SaleItemInput[]>([
    { productId: '', productName: '', sku: '', quantity: '1', unitPrice: '0' },
  ]);
  const [payments, setPayments] = useState<PaymentInput[]>([
    { paymentMethod: 'CASH', amount: '0', reference: '' },
  ]);
  const [idempotencyKey, setIdempotencyKey] = useState(`sale-${Date.now()}`);
  const [storeId, setStoreId] = useState('');
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');

  const loading = isLoading || storesQuery.isLoading || productsQuery.isLoading;
  if (loading) return <LoadingState message="Loading sales..." />;
  const requestError = error ?? storesQuery.error ?? productsQuery.error;
  if (isError || (canCreateSale && (storesQuery.isError || productsQuery.isError))) {
    return <ErrorState title="Could not load sales" description={requestError?.message} />;
  }

  const storeOptions = stores?.items || [];
  const productOptions = products?.items || [];

  const total = items.reduce((sum, item) => {
    const price = Number(item.unitPrice);
    const quantity = Number(item.quantity);
    return sum + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
  }, 0);

  const totalPayment = payments.reduce((sum, payment) => {
    const amount = Number(payment.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const handleAddItem = () => {
    setItems([
      ...items,
      { productId: '', productName: '', sku: '', quantity: '1', unitPrice: '0' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddPayment = () => {
    setPayments([...payments, { paymentMethod: 'CASH', amount: '0', reference: '' }]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, productId: string) => {
    const selected = productOptions.find((p: any) => p.id === productId);
    setItems((current) => current.map((item, itemIndex) => itemIndex === index
      ? {
          ...item,
          productId,
          sku: selected?.sku || '',
          productName: selected?.name || '',
          unitPrice: selected?.sellingPrice?.toString() || '0',
        }
      : item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) {
      toast.error('Please select a store');
      return;
    }
    if (items.some((i) => !i.productId)) {
      toast.error('Please select products for all items');
      return;
    }
    if (items.some((item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      toast.error('Enter a positive quantity for every sale item.');
      return;
    }
    if (payments.some((payment) => !Number.isFinite(Number(payment.amount)) || Number(payment.amount) < 0)) {
      toast.error('Enter a valid non-negative amount for each payment.');
      return;
    }

    try {
      await createSale.mutateAsync({
        storeId,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        payments: payments.map((p) => ({
          paymentMethod: p.paymentMethod,
          amount: p.amount,
          reference: p.reference || null,
        })),
        notes: notes || null,
        promoCode: promoCode || null,
        idempotencyKey,
      });
      toast.success('Sale created successfully');
      setStoreId('');
      setNotes('');
      setPromoCode('');
      setItems([{ productId: '', productName: '', sku: '', quantity: '1', unitPrice: '0' }]);
      setPayments([{ paymentMethod: 'CASH', amount: '0', reference: '' }]);
      setIdempotencyKey(`sale-${Date.now()}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create sale');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-h1 text-primary">POS Sales</h1>
          <p className="text-body-sm text-muted">Process sales and record payments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canCreateSale && <Card className="col-span-1 lg:col-span-2 p-6">
          <h2 className="text-heading-h4 text-primary mb-6">New Sale</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
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
              <div className="col-span-2">
                <Input
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label="Promo Code (optional)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="e.g. BLACKFRIDAY20"
                />
              </div>
            </div>

            <div className="border border-default rounded-lg p-4 mb-4">
              <h3 className="text-title-md text-primary mb-3">Items</h3>
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start mb-3">
                  <select
                    value={item.productId}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                    className="w-64"
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
                    min="0.0001"
                    step="0.0001"
                    value={item.quantity}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[index].quantity = e.target.value;
                      setItems(newItems);
                    }}
                    className="w-24"
                  />
                  <Input label="Unit Price" type="number" value={item.unitPrice} readOnly className="w-32" />
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                + Add Item
              </Button>
            </div>

            <div className="border border-default rounded-lg p-4 mb-4">
              <h3 className="text-title-md text-primary mb-3">Payments</h3>
              {payments.map((payment, index) => (
                <div key={index} className="flex gap-3 items-start mb-3">
                  <select
                    value={payment.paymentMethod}
                    onChange={(e) => {
                      const newPayments = [...payments];
                      newPayments[index].paymentMethod = e.target.value;
                      setPayments(newPayments);
                    }}
                    className="input w-40"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE">Mobile Money</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                  <Input
                    label="Amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.amount}
                    onChange={(e) => {
                      const newPayments = [...payments];
                      newPayments[index].amount = e.target.value;
                      setPayments(newPayments);
                    }}
                    required
                    className="w-40"
                  />
                  <Input
                    label="Reference"
                    value={payment.reference || ''}
                    onChange={(e) => {
                      const newPayments = [...payments];
                      newPayments[index].reference = e.target.value;
                      setPayments(newPayments);
                    }}
                    className="w-48"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemovePayment(index)}
                    disabled={payments.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={handleAddPayment}>
                + Add Payment
              </Button>
            </div>

            <div className="flex justify-between items-end pt-4 border-t border-default">
              <div className="text-right">
                <div className="text-body-sm text-muted">Sale Total</div>
                <div className="text-heading-h2 text-primary font-mono tabular-nums">
                  {formatTzs(total)}
                </div>
                <div className="text-caption text-muted">Estimated subtotal; the server validates discounts and final due.</div>
              </div>
              <div className="text-right">
                <div className="text-body-sm text-muted">Payment Total</div>
                <div className="text-heading-h2 text-success font-mono tabular-nums">
                  {formatTzs(totalPayment)}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={createSale.isPending}
              className="w-full"
              disabled={createSale.isPending || items.length === 0 || !storeId}
            >
              Complete Sale
            </Button>
          </form>
        </Card>}

        <Card className="col-span-1 lg:col-span-1 p-6 h-full flex flex-col">
          <h2 className="text-heading-h4 text-primary mb-6">Recent Sales</h2>
          {data?.items.length === 0 ? (
            <EmptyState
              title="No recent sales"
              description="Process your first sale to see activity here."
            />
          ) : (
            <div className="overflow-y-auto max-h-[500px]">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Sale #</th>
                    <th>Store</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((sale: any) => (
                    <tr key={sale.id}>
                      <td className="font-mono text-sm">{sale.saleNumber}</td>
                      <td>{sale.store?.name || '—'}</td>
                      <td className="text-right font-mono tabular-nums">
                        {formatTzs(sale.totalAmount)}
                      </td>
                      <td>
                        <Badge variant={sale.status === 'COMPLETED' ? 'success' : 'danger'}>
                          {sale.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
