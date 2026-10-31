import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useCampaignAnalytics,
  useCustomerSegments,
  useCreateCustomerSegment,
  useDeleteCustomerSegment,
  useAddCustomerToSegment,
  useRemoveCustomerFromSegment,
} from '../../hooks/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'react-hot-toast';

const CAMPAIGN_TYPES = [
  { value: 'PERCENTAGE_DISCOUNT', label: 'Percentage Discount' },
  { value: 'FIXED_AMOUNT_DISCOUNT', label: 'Fixed Amount Discount' },
  { value: 'BUY_X_GET_Y', label: 'Buy X Get Y' },
  { value: 'BUNDLE_PRICING', label: 'Bundle Pricing' },
  { value: 'TIERED_SPEND', label: 'Tiered Spend Discount' },
];

const MECHANISMS = [
  { value: 'PROMO_CODE', label: 'Promo Code' },
  { value: 'AUTOMATIC', label: 'Automatic' },
  { value: 'BOTH', label: 'Both' },
];

const TARGETINGS = [
  { value: 'ALL_CUSTOMERS', label: 'All Customers' },
  { value: 'LOYALTY_MEMBERS', label: 'Loyalty Members' },
  { value: 'FIRST_TIME_BUYERS', label: 'First-Time Buyers' },
  { value: 'SEGMENT_BASED', label: 'Customer Segments' },
];

const STATUSES = [
  { value: 'DRAFT', label: 'Draft', variant: 'warning' },
  { value: 'ACTIVE', label: 'Active', variant: 'success' },
  { value: 'PAUSED', label: 'Paused', variant: 'warning' },
  { value: 'EXPIRED', label: 'Expired', variant: 'danger' },
];

export function CampaignsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useCampaigns();
  const { data: segments, isLoading: segmentsLoading } = useCustomerSegments();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const createSegment = useCreateCustomerSegment();
  const deleteSegment = useDeleteCustomerSegment();
  const addCustomerToSegment = useAddCustomerToSegment();
  const removeCustomerFromSegment = useRemoveCustomerFromSegment();

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openSegmentCreate, setOpenSegmentCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);

  // Create campaign form state
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    type: 'PERCENTAGE_DISCOUNT',
    mechanism: 'BOTH',
    promoCode: '',
    value: '',
    buyQuantity: '',
    getQuantity: '',
    customerTargeting: 'ALL_CUSTOMERS',
    segmentIds: [],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    maxUses: '',
    maxUsesPerCustomer: '',
    stackingRule: 'STACKABLE',
    productIds: [],
  });

  if (isLoading || segmentsLoading) return <LoadingState message="Loading campaigns..." />;

  const campaigns = data?.items || [];
  const campaignSegments = segments || [];

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endDate = newCampaign.endDate || null;
      await createCampaign.mutateAsync({
        name: newCampaign.name,
        description: newCampaign.description || null,
        type: newCampaign.type,
        mechanism: newCampaign.mechanism,
        promoCode: newCampaign.promoCode || null,
        value: newCampaign.value,
        buyQuantity: newCampaign.buyQuantity ? parseInt(newCampaign.buyQuantity) : null,
        getQuantity: newCampaign.getQuantity ? parseInt(newCampaign.getQuantity) : null,
        customerTargeting: newCampaign.customerTargeting,
        segmentIds: newCampaign.customerTargeting === 'SEGMENT_BASED' ? newCampaign.segmentIds : [],
        startDate: newCampaign.startDate,
        endDate,
        maxUses: newCampaign.maxUses ? parseInt(newCampaign.maxUses) : null,
        maxUsesPerCustomer: newCampaign.maxUsesPerCustomer ? parseInt(newCampaign.maxUsesPerCustomer) : null,
        stackingRule: newCampaign.stackingRule,
        productIds: newCampaign.productIds,
      });
      toast.success('Campaign created');
      setOpenCreate(false);
      setNewCampaign({
        name: '', description: '', type: 'PERCENTAGE_DISCOUNT', mechanism: 'BOTH',
        promoCode: '', value: '', buyQuantity: '', getQuantity: '',
        customerTargeting: 'ALL_CUSTOMERS', segmentIds: [],
        startDate: new Date().toISOString().split('T')[0], endDate: '',
        maxUses: '', maxUsesPerCustomer: '', stackingRule: 'STACKABLE', productIds: [],
      });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create campaign');
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    try {
      await updateCampaign.mutateAsync({
        id: editingCampaign.id,
        body: {
          name: newCampaign.name,
          description: newCampaign.description || null,
          type: newCampaign.type,
          mechanism: newCampaign.mechanism,
          promoCode: newCampaign.promoCode || null,
          value: newCampaign.value,
          customerTargeting: newCampaign.customerTargeting,
          segmentIds: newCampaign.customerTargeting === 'SEGMENT_BASED' ? newCampaign.segmentIds : [],
          startDate: newCampaign.startDate,
          endDate: newCampaign.endDate || null,
          maxUses: newCampaign.maxUses ? parseInt(newCampaign.maxUses) : null,
          maxUsesPerCustomer: newCampaign.maxUsesPerCustomer ? parseInt(newCampaign.maxUsesPerCustomer) : null,
          stackingRule: newCampaign.stackingRule,
        },
      });
      toast.success('Campaign updated');
      setOpenEdit(false);
      setEditingCampaign(null);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to update campaign');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await deleteCampaign.mutateAsync(id);
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete campaign');
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await updateCampaign.mutateAsync({ id, body: { status: 'ACTIVE' } });
      toast.success('Campaign activated');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to activate campaign');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await updateCampaign.mutateAsync({ id, body: { status: 'PAUSED' } });
      toast.success('Campaign paused');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to pause campaign');
    }
  };

  const handleSegmentCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSegment.mutateAsync({
        name: newCampaign.name,
        type: newCampaign.type,
        rules: {},
        description: newCampaign.description || null,
      });
      toast.success('Segment created');
      setOpenSegmentCreate(false);
      queryClient.invalidateQueries({ queryKey: ['customer-segments'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create segment');
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-h1 text-primary">Sales Campaigns</h1>
          <p className="text-body-sm text-muted">Create and manage promotional campaigns and discounts</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setOpenCreate(true)}>
          Create Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns"
          description="Create your first sales campaign to run promotions and discounts."
          action={<Button variant="primary" onClick={() => setOpenCreate(true)}>Create Campaign</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Mechanism</th>
                <th>Promo Code</th>
                <th>Value</th>
                <th>Status</th>
                <th>Date Range</th>
                <th>Uses</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: any) => (
                <tr key={c.id}>
                  <td className="font-mono text-sm">{c.name}</td>
                  <td>{c.type}</td>
                  <td>{c.mechanism}</td>
                  <td className="font-mono text-sm">{c.promoCode || '—'}</td>
                  <td className="text-right">{c.type === 'PERCENTAGE_DISCOUNT' ? c.value + '%' : formatCurrency(Number(c.value))}</td>
                  <td>
                    <Badge variant={(STATUSES.find(s => s.value === c.status)?.variant || 'success') as 'success' | 'warning' | 'danger'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="text-body-sm text-muted font-mono">
                    {new Date(c.startDate).toLocaleDateString()} - {c.endDate ? new Date(c.endDate).toLocaleDateString() : 'Ongoing'}
                  </td>
                  <td className="text-right font-mono tabular-nums text-sm">{c._count?.usages || 0}</td>
                  <td>
                    <div className="flex gap-1">
                      {c.status === 'DRAFT' && (
                        <Button variant="outline" size="sm" onClick={() => handleActivate(c.id)}>
                          Activate
                        </Button>
                      )}
                      {c.status === 'ACTIVE' && (
                        <Button variant="outline" size="sm" onClick={() => handlePause(c.id)}>
                          Pause
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditingCampaign(c)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(c.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Campaign Modal */}
      {openCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl p-6">
            <h2 className="text-heading-h4 text-primary mb-6">Create Campaign</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Campaign Name"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  required
                />
                <select
                  value={newCampaign.type}
                  onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                  className="input w-full"
                  required
                >
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={newCampaign.mechanism}
                  onChange={(e) => setNewCampaign({ ...newCampaign, mechanism: e.target.value })}
                  className="input w-full"
                  required
                >
                  {MECHANISMS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <Input
                  label="Promo Code"
                  value={newCampaign.promoCode}
                  onChange={(e) => setNewCampaign({ ...newCampaign, promoCode: e.target.value })}
                  placeholder="e.g. BLACKFRIDAY20"
                />
                <Input
                  label="Discount Value"
                  type="number"
                  step="0.01"
                  value={newCampaign.value}
                  onChange={(e) => setNewCampaign({ ...newCampaign, value: e.target.value })}
                  placeholder="e.g. 20 or 10.00"
                  required
                />
                <select
                  value={newCampaign.customerTargeting}
                  onChange={(e) => setNewCampaign({ ...newCampaign, customerTargeting: e.target.value })}
                  className="input w-full"
                  required
                >
                  {TARGETINGS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={newCampaign.startDate}
                  onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                  required
                />
                <Input
                  label="End Date"
                  type="date"
                  value={newCampaign.endDate}
                  onChange={(e) => setNewCampaign({ ...newCampaign, endDate: e.target.value })}
                />
                <Input
                  label="Max Uses (total)"
                  type="number"
                  value={newCampaign.maxUses}
                  onChange={(e) => setNewCampaign({ ...newCampaign, maxUses: e.target.value })}
                />
                <Input
                  label="Max Uses Per Customer"
                  type="number"
                  value={newCampaign.maxUsesPerCustomer}
                  onChange={(e) => setNewCampaign({ ...newCampaign, maxUsesPerCustomer: e.target.value })}
                />
                <select
                  value={newCampaign.stackingRule}
                  onChange={(e) => setNewCampaign({ ...newCampaign, stackingRule: e.target.value })}
                  className="input w-full"
                >
                  <option value="STACKABLE">Stackable with other discounts</option>
                  <option value="BEST_ONLY">Best discount only</option>
                  <option value="EXCLUSIVE">Exclusive (no stacking)</option>
                </select>
              </div>

              <div className="flex justify-end pt-4 border-t border-default">
                <Button type="button" variant="outline" size="md" onClick={() => setOpenCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={createCampaign.isPending} className="w-full" disabled={createCampaign.isPending}>
                  Create Campaign
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Customer Segments Section */}
      <Card className="mt-8 p-6">
        <h2 className="text-heading-h4 text-primary mb-6">Customer Segments</h2>
        <p className="text-body-sm text-muted mb-4">Group customers for targeted campaigns (loyalty, VIP, first-time buyers, etc.)</p>

        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" size="md" onClick={() => setOpenSegmentCreate(true)}>
            Create Segment
          </Button>
        </div>

        {campaignSegments.length === 0 ? (
          <EmptyState title="No segments" description="Create your first customer segment." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Members</th>
                  <th>Campaigns</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaignSegments.map((s: any) => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm">{s.name}</td>
                    <td>{s.type}</td>
                    <td className="text-right font-mono tabular-nums">{s._count?.memberships || 0}</td>
                    <td className="text-right font-mono tabular-nums">{s._count?.campaigns || 0}</td>
                    <td>
                      <Button variant="danger" size="sm" onClick={() => {
                        if (confirm('Delete this segment?')) deleteSegment.mutate(s.id);
                      }}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Segment Modal */}
      {openSegmentCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-heading-h4 text-primary mb-6">Create Customer Segment</h2>
            <form onSubmit={handleSegmentCreate} className="space-y-4">
              <Input
                label="Segment Name"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                required
              />
              <select
                value={newCampaign.type}
                onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                className="input w-full"
                required
              >
                <option value="LOYALTY">Loyalty Members</option>
                <option value="VIP">VIP Customers</option>
                <option value="FIRST_TIME">First-Time Buyers</option>
                <option value="INACTIVE">Inactive Customers</option>
                <option value="CUSTOM">Custom</option>
              </select>
              <Input
                label="Description"
                value={newCampaign.description}
                onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
              />
              <div className="flex justify-end pt-4 border-t border-default">
                <Button type="button" variant="outline" size="md" onClick={() => setOpenSegmentCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={createSegment.isPending} className="w-full" disabled={createSegment.isPending}>
                  Create Segment
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
