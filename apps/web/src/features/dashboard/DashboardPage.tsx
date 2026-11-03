import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatTzs } from '../../lib/formatters';
import {
  useSalesSummary,
  useInventoryReport,
} from '../../hooks/api';

export function DashboardPage() {
  const { data: salesSummary, isLoading: salesLoading } = useSalesSummary();
  const { data: inventoryReport, isLoading: inventoryLoading } = useInventoryReport();

  const loading = salesLoading || inventoryLoading;

  const totalSales = salesSummary?.totalSales || 0;
  const totalRevenue = salesSummary?.totalRevenue || '0.00';
  const averageOrderValue = salesSummary?.averageOrderValue || '0.00';
  const lowStockItems = inventoryReport?.lowStockCount || 0;

  if (loading) return <LoadingState message="Loading dashboard..." />;

  const topProducts = salesSummary?.topProducts || [];
  const lowStockAlerts = inventoryReport?.lowStockItems || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-h1 text-primary">Overview</h1>
        <div className="text-body-sm text-muted">Real-time figures from your persisted data</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-label-sm text-muted">Total Sales</div>
          <div className="text-heading-h2 text-primary">{totalSales}</div>
        </Card>
        <Card className="p-4">
          <div className="text-label-sm text-muted">Total Revenue</div>
          <div className="text-heading-h2 text-primary font-mono tabular-nums">{formatTzs(totalRevenue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-label-sm text-muted">Avg Order Value</div>
          <div className="text-heading-h2 text-primary font-mono tabular-nums">{formatTzs(averageOrderValue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-label-sm text-muted">Low Stock</div>
          <div className="text-heading-h2 text-warning">{lowStockItems}</div>
          {lowStockItems > 0 ? (
            <Badge variant="warning">Needs attention</Badge>
          ) : (
            <Badge variant="success">All clear</Badge>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 lg:col-span-2 h-80 flex flex-col">
          <h2 className="text-heading-h4 text-primary mb-4">Top Products</h2>
          {topProducts.length === 0 ? (
            <EmptyState
              title="No product sales in this period"
              description="Completed product sales will appear here."
              action={
                <Link className="btn btn-primary btn-md" to="/app/sales">Open sales</Link>
              }
            />
          ) : (
            <div className="overflow-y-auto flex-1">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.slice(0, 10).map((p: any) => (
                    <tr key={p.name || p.id}>
                      <td className="font-mono text-sm">{p.name || 'Unknown Product'}</td>
                      <td className="text-right font-mono tabular-nums text-sm">
                        {formatTzs(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="h-80 flex flex-col">
          <h2 className="text-heading-h4 text-primary mb-4">Inventory Alerts</h2>
          {lowStockAlerts.length === 0 ? (
            <EmptyState
              title="No low stock alerts"
              description="All products are within stock thresholds."
            />
          ) : (
            <div className="overflow-y-auto flex-1">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>On Hand</th>
                    <th>Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockAlerts.slice(0, 10).map((item: any) => (
                    <tr key={item.id || item.sku}>
                      <td className="font-mono text-sm">{item.name || item.sku || 'Unknown'}</td>
                      <td className="text-right font-mono tabular-nums text-sm">
                        {item.quantityOnHand?.toFixed?.() ?? item.quantityOnHand ?? '0'}
                      </td>
                      <td className="text-right font-mono tabular-nums text-sm">
                        {item.lowStockThreshold?.toFixed?.() ?? item.lowStockThreshold ?? '0'}
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
