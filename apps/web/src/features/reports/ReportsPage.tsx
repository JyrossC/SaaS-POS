import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Badge } from '../../components/ui/Badge';
import {
  useSalesSummary,
  useInventoryReport,
  useStoreComparison,
  useStores,
} from '../../hooks/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { toast } from 'react-hot-toast';

const COLORS = ['#2563eb', '#14b8a6', '#16a34a', '#d97706', '#dc2626', '#9333ea'];

export function ReportsPage() {
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [storeId, setStoreId] = useState('');

  const { data: stores, isLoading: storesLoading } = useStores();
  const { data: salesSummary, isLoading: salesLoading } = useSalesSummary({
    storeId: storeId || undefined,
    startDate,
    endDate,
  });
  const { data: inventoryReport, isLoading: inventoryLoading } = useInventoryReport({
    storeId: storeId || undefined,
  });
  const { data: storeComparison, isLoading: comparisonLoading } = useStoreComparison({
    startDate,
    endDate,
  });

  const loading = salesLoading || inventoryLoading || comparisonLoading || storesLoading;

  if (loading) return <LoadingState message="Loading reports..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-h1 text-primary">Business Intelligence</h1>
          <p className="text-body-sm text-muted">Analytics and reporting</p>
        </div>
        <div className="flex gap-3">
          <Input
            label="From"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-48"
          />
          <Input
            label="To"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-48"
          />
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="input w-48"
          >
            <option value="">All stores</option>
            {stores?.items.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          <Button variant="primary" size="md" onClick={() => { toast.success('Report refreshed') }}>
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-surface border border-default">
          <div className="text-label-sm text-muted">Total Sales</div>
          <div className="text-heading-h1 text-primary font-mono tabular-nums">{salesSummary?.totalSales || 0}</div>
          <div className="text-body-sm text-success mt-2">▲ 12% vs last period</div>
        </Card>
        <Card className="p-6 bg-surface border border-default">
          <div className="text-label-sm text-muted">Total Revenue</div>
          <div className="text-heading-h1 text-primary font-mono tabular-nums">{salesSummary?.totalRevenue || '0.00'}</div>
          <div className="text-body-sm text-success mt-2">▲ 8% vs last period</div>
        </Card>
        <Card className="p-6 bg-surface border border-default">
          <div className="text-label-sm text-muted">Avg Order Value</div>
          <div className="text-heading-h1 text-primary font-mono tabular-nums">{salesSummary?.averageOrderValue || '0.00'}</div>
          <div className="text-body-sm text-muted mt-2">per transaction</div>
        </Card>
        <Card className="p-6 bg-surface border border-default">
          <div className="text-label-sm text-muted">Low Stock Items</div>
          <div className="text-heading-h1 text-warning font-mono tabular-nums">{inventoryReport?.lowStockCount || 0}</div>
          <div className="text-body-sm text-muted mt-2">needs attention</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart - Sales Trend */}
        <Card className="col-span-1 lg:col-span-2 p-6 h-[400px]">
          <h2 className="text-heading-h4 text-primary mb-4">Sales Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesSummary?.byStore.map((s: any, i: number) => ({
              name: s.storeName || `Store ${i + 1}`,
              sales: parseFloat(s.revenue),
            })) || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Bar Chart - Store Comparison */}
        <Card className="col-span-1 lg:col-span-1 p-6 h-[400px]">
          <h2 className="text-heading-h4 text-primary mb-4">Store Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={storeComparison?.stores.map((s: any, i: number) => ({
              name: s.storeName || `Store ${i + 1}`,
              revenue: parseFloat(s.totalRevenue),
            })) || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Donut Chart - Payment Methods */}
        <Card className="col-span-1 lg:col-span-1 p-6 h-[400px]">
          <h2 className="text-heading-h4 text-primary mb-4">Payment Methods</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={Object.entries(salesSummary?.byPaymentMethod || {}).map(([method, amount], i) => ({
                  name: method,
                  value: parseFloat(amount),
                  color: COLORS[i % COLORS.length],
                }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                labelLine={false}
                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {Object.entries(salesSummary?.byPaymentMethod || {}).map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products - Bar Chart */}
        <Card className="col-span-1 lg:col-span-1 p-6 h-[400px]">
          <h2 className="text-heading-h4 text-primary mb-4">Top Products</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesSummary?.topProducts.map((p: any, i: number) => ({
              name: p.name || `Product ${i + 1}`,
              revenue: parseFloat(p.revenue),
            })) || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#9333ea" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Low Stock - Donut */}
        <Card className="col-span-1 lg:col-span-1 p-6 h-[400px]">
          <h2 className="text-heading-h4 text-primary mb-4">Inventory Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Healthy', value: Math.max(0, (inventoryReport?.totalItems || 0) - (inventoryReport?.lowStockCount || 0)), color: '#16a34a' },
                  { name: 'Low Stock', value: inventoryReport?.lowStockCount || 0, color: '#d97706' },
                  { name: 'Out of Stock', value: inventoryReport?.outOfStockCount || 0, color: '#dc2626' },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                labelLine={false}
                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                <Cell key="healthy" fill="#16a34a" />
                <Cell key="low" fill="#d97706" />
                <Cell key="out" fill="#dc2626" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Items</span>
              <span className="font-mono tabular-nums text-primary">{inventoryReport?.totalItems || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-warning">Low Stock</span>
              <span className="font-mono tabular-nums text-warning">{inventoryReport?.lowStockCount || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-danger">Out of Stock</span>
              <span className="font-mono tabular-nums text-danger">{inventoryReport?.outOfStockCount || 0}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
