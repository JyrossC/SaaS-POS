import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { toast } from 'react-hot-toast';

interface Product {
  id: string;
  sku: string;
  name: string;
  baseUnit: string;
  sellingPrice: number;
  costPrice?: number | null;
  isActive: boolean;
}

export function ProductsPage({ onCreateSale }: { onCreateSale?: () => void } = {}) {
  const [creating, setCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    description: '',
    baseUnit: 'unit',
    sellingPrice: '0',
    costPrice: '0',
  });

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await apiClient.get<{ items: Product[]; total: number }>('/products');
      if (!response.success) {
        throw new Error(response.error?.message || 'Request failed');
      }
      return response.data!;
    },
  });

  const createProduct = async (body: {
    sku: string;
    name: string;
    description?: string | null;
    baseUnit: string;
    sellingPrice: string;
    costPrice?: string | null;
  }) => {
    const response = await apiClient.post<{ id: string; sku: string; name: string }>('/products', body);
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create product');
    }
    return response.data!;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProduct({
        sku: newProduct.sku,
        name: newProduct.name,
        description: newProduct.description || null,
        baseUnit: newProduct.baseUnit,
        sellingPrice: newProduct.sellingPrice,
        costPrice: newProduct.costPrice || null,
      });
      toast.success('Product created');
      setCreating(false);
      setNewProduct({ sku: '', name: '', description: '', baseUnit: 'unit', sellingPrice: '0', costPrice: '0' });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create product');
    }
  };

  if (isLoading) return <LoadingState message="Loading products..." />;
  if (error) return <ErrorState title="Failed to load products" description={error instanceof Error ? error.message : String(error)} />;

  const itemList = products?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-h1 text-primary">Product Catalogue</h1>
          <p className="text-body-sm text-muted">Manage your product inventory</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => setCreating(!creating)}
            disabled={creating}
          >
            {creating ? 'Cancel' : 'Add Product'}
          </Button>
          {onCreateSale && (
            <Button variant="primary" size="md" onClick={onCreateSale}>
              New Sale
            </Button>
          )}
        </div>
      </div>

      {creating && (
        <Card className="col-span-1 lg:col-span-3 p-6">
          <h2 className="text-heading-h4 text-primary mb-6">Add New Product</h2>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="SKU"
                value={newProduct.sku}
                onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                required
              />
              <Input
                label="Name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                required
              />
              <Input
                label="Description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              />
              <Input
                label="Base Unit"
                value={newProduct.baseUnit}
                onChange={(e) => setNewProduct({ ...newProduct, baseUnit: e.target.value })}
                required
              />
              <Input
                label="Selling Price"
                type="number"
                step="0.01"
                value={newProduct.sellingPrice}
                onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: e.target.value })}
                required
              />
              <Input
                label="Cost Price"
                type="number"
                step="0.01"
                value={newProduct.costPrice}
                onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value })}
              />
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Create Product
            </Button>
          </form>
        </Card>
      )}

      {itemList.length === 0 ? (
        <EmptyState
          title="No products found"
          description={creating ? '' : 'Add your first product to get started.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Base Unit</th>
                <th>Selling Price</th>
                <th>Cost Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {itemList.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-sm">{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.baseUnit}</td>
                  <td className="text-right">{p.sellingPrice.toFixed(2)}</td>
                  <td className="text-right">
                    {p.costPrice !== null && p.costPrice !== undefined ? p.costPrice.toFixed(2) : '—'}
                  </td>
                  <td>
                    <Badge variant={p.isActive ? 'success' : 'danger'}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
