import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Badge } from '../../components/ui/Badge';
import { useBatches, useExpiringBatches, useCreateBatch, useDispense, useQuarantineStock, useReleaseQuarantine, usePrescriptions, useCreatePrescription } from '../../hooks/api';
import { toast } from 'react-hot-toast';

interface BatchItemInput {
  storeId: string;
  productId: string;
  batchNumber: string;
  quantityReceived: string;
  costPerUnit: string;
  expiresAt: string;
}

interface QuarantineInput {
  storeId: string;
  batchId: string;
  quantity: string;
  reason: string;
}

interface DispenseItemInput {
  productId: string;
  quantity: string;
}

export function PharmacyPage() {
  const { data: batches, isLoading: batchesLoading } = useBatches();
  const { data: expiring, isLoading: expiringLoading } = useExpiringBatches({ days: 30 });
  const { data: prescriptions, isLoading: prescriptionsLoading } = usePrescriptions();
  const createBatch = useCreateBatch();
  const dispense = useDispense();
  const quarantineStock = useQuarantineStock();
  const releaseQuarantine = useReleaseQuarantine();
  const createPrescription = useCreatePrescription();

  const [newBatch, setNewBatch] = useState<BatchItemInput>({
    storeId: '',
    productId: '',
    batchNumber: '',
    quantityReceived: '0',
    costPerUnit: '0',
    expiresAt: '',
  });
  const [quarantineForm, setQuarantineForm] = useState<QuarantineInput>({
    storeId: '', batchId: '', quantity: '1', reason: '',
  });
  const [releaseQuarantineId, setReleaseQuarantineId] = useState('');
  const [releaseQuarantineQty, setReleaseQuarantineQty] = useState('1');

  const [dispenseItems, setDispenseItems] = useState<DispenseItemInput[]>([
    { productId: '', quantity: '1' },
  ]);
  const [dispenseStoreId, setDispenseStoreId] = useState('');

  const [newPrescription, setNewPrescription] = useState<{
    storeId: string;
    patientName: string;
    patientId: string;
    prescriberName: string;
    prescriberLicense: string;
    items: Array<{ productId: string; quantityPrescribed: string }>;
  }>({
    storeId: '',
    patientName: '',
    patientId: '',
    prescriberName: '',
    prescriberLicense: '',
    items: [{ productId: '', quantityPrescribed: '1' }],
  });

  if (batchesLoading || expiringLoading || prescriptionsLoading) return <LoadingState message="Loading pharmacy data..." />;

  const expiringCount = expiring?.length || 0;
  const activeQuarantines = batches?.filter((b: any) => b.isQuarantined) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-heading-h1 text-primary">Pharmacy</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="col-span-1 lg:col-span-1 p-6 h-full bg-critical/5 border border-critical/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body-sm text-danger">Expiring Batches (30 days)</p>
              <div className="text-heading-h1 text-danger font-mono tabular-nums">{expiring?.length || 0}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
              <span className="text-danger">⚠</span>
            </div>
          </div>
        </Card>

        <Card className="col-span-1 lg:col-span-1 p-6 h-full bg-warning/5 border border-warning/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body-sm text-warning">Active Batches</p>
              <div className="text-heading-h1 text-warning font-mono tabular-nums">{batches?.length || 0}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
              <span className="text-warning">📦</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 p-6">
          <h2 className="text-heading-h4 text-primary mb-6">Create Batch</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            createBatch.mutate(newBatch, {
              onSuccess: () => {
                setNewBatch({ storeId: '', productId: '', batchNumber: '', quantityReceived: '0', costPerUnit: '0', expiresAt: '' });
                toast.success('Batch received into store inventory.');
              },
              onError: (error) => toast.error(error.message),
            });
          }} className="space-y-4">
            <Input label="Store ID" value={newBatch.storeId} onChange={(e) => setNewBatch({...newBatch, storeId: e.target.value})} required />
            <Input label="Product ID" value={newBatch.productId} onChange={(e) => setNewBatch({...newBatch, productId: e.target.value})} required />
            <Input label="Batch Number" value={newBatch.batchNumber} onChange={(e) => setNewBatch({...newBatch, batchNumber: e.target.value})} required />
            <Input label="Quantity Received" type="number" min="0.0001" step="0.0001" value={newBatch.quantityReceived} onChange={(e) => setNewBatch({...newBatch, quantityReceived: e.target.value})} required />
            <Input label="Unit Cost" type="number" min="0" step="0.0001" value={newBatch.costPerUnit} onChange={(e) => setNewBatch({...newBatch, costPerUnit: e.target.value})} />
            <Input label="Expires At" type="datetime-local" value={newBatch.expiresAt} onChange={(e) => setNewBatch({...newBatch, expiresAt: e.target.value})} required />
            <Button type="submit" variant="primary" size="md" isLoading={createBatch.isPending} className="w-full" disabled={createBatch.isPending}>
              Create Batch
            </Button>
          </form>
        </Card>

        <Card className="col-span-1 lg:col-span-1 p-6 h-full">
          <h2 className="text-heading-h4 text-primary mb-6">Dispense</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            dispense.mutate({
              storeId: dispenseStoreId,
              items: dispenseItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
            });
          }} className="space-y-4">
            <Input label="Store ID" value={dispenseStoreId} onChange={(e) => setDispenseStoreId(e.target.value)} required />
            {dispenseItems.map((item, index) => (
              <div key={index} className="flex gap-3 items-start mb-3">
                <Input label="Product ID" value={item.productId} onChange={(e) => {
                  const n = [...dispenseItems]; n[index].productId = e.target.value; setDispenseItems(n);
                }} className="w-48" required />
                <Input label="Qty" type="number" value={item.quantity} onChange={(e) => {
                  const n = [...dispenseItems]; n[index].quantity = e.target.value; setDispenseItems(n);
                }} className="w-32" required />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setDispenseItems([...dispenseItems, { productId: '', quantity: '1' }])}>
              + Add Item
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={dispense.isPending} className="w-full mt-4" disabled={dispense.isPending}>
              Dispense
            </Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2 p-6">
          <h2 className="text-heading-h4 text-primary mb-6">All Batches</h2>
          {batches?.length === 0 ? (
            <EmptyState title="No batches" description="Create your first batch." />
          ) : (
            <div className="overflow-y-auto max-h-[400px]">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Batch #</th>
                    <th>Product</th>
                    <th>Expires</th>
                    <th>Qty Received</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches?.map((b: any) => (
                    <tr key={b.id}>
                      <td className="font-mono text-sm">{b.batchNumber}</td>
                      <td>{b.productId}</td>
                      <td className="font-mono text-sm">{new Date(b.expiresAt).toLocaleDateString()}</td>
                      <td className="font-mono tabular-nums">{parseFloat(b.quantityReceived).toFixed(0)}</td>
                      <td>
                        <Badge variant={new Date(b.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && new Date(b.expiresAt) > new Date() ? 'warning' : 'success'}>
                          {new Date(b.expiresAt) < new Date() ? 'Expired' : 'Active'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="col-span-1 lg:col-span-1 p-6 h-full">
          <h2 className="text-heading-h4 text-primary mb-6">Quarantine Stock</h2>
          <p className="text-body-sm text-muted mb-4">Quarantine expired or compromised stock.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            quarantineStock.mutate(quarantineForm, {
              onSuccess: () => {
                setQuarantineForm({ storeId: '', batchId: '', quantity: '1', reason: '' });
                toast.success('Stock quarantined.');
              },
              onError: (error) => toast.error(error.message),
            });
          }} className="space-y-4">
            <Input label="Store ID" value={quarantineForm.storeId} onChange={(e) => setQuarantineForm({...quarantineForm, storeId: e.target.value})} required />
            <Input label="Batch ID" value={quarantineForm.batchId} onChange={(e) => setQuarantineForm({...quarantineForm, batchId: e.target.value})} required />
            <Input label="Quantity" type="number" min="0.0001" step="0.0001" value={quarantineForm.quantity} onChange={(e) => setQuarantineForm({...quarantineForm, quantity: e.target.value})} required />
            <Input label="Reason" placeholder="e.g. expired, damaged" value={quarantineForm.reason} onChange={(e) => setQuarantineForm({...quarantineForm, reason: e.target.value})} required />
            <Button type="submit" variant="danger" size="md" className="w-full" disabled={quarantineStock.isPending} isLoading={quarantineStock.isPending}>
              Quarantine Stock
            </Button>
          </form>
        </Card>

        <Card className="col-span-1 lg:col-span-1 p-6 h-full">
          <h2 className="text-heading-h4 text-primary mb-6">Release Quarantine</h2>
          <p className="text-body-sm text-muted mb-4">Release quarantined stock back to available inventory.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            releaseQuarantine.mutate({ quarantineId: releaseQuarantineId }, {
              onSuccess: () => {
                setReleaseQuarantineId('');
                setReleaseQuarantineQty('1');
                toast.success('Quarantined stock released.');
              },
              onError: (error) => toast.error(error.message),
            });
          }} className="space-y-4">
            <Input label="Quarantine ID" value={releaseQuarantineId} onChange={(e) => setReleaseQuarantineId(e.target.value)} required />
            <Input label="Quantity to Release" type="number" min="0.0001" step="0.0001" value={releaseQuarantineQty} onChange={(e) => setReleaseQuarantineQty(e.target.value)} required />
            <Button type="submit" variant="primary" size="md" className="w-full" disabled={releaseQuarantine.isPending} isLoading={releaseQuarantine.isPending}>
              Release Quarantine
            </Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2 p-6">
          <h2 className="text-heading-h4 text-primary mb-6">Prescription Intake</h2>
          <p className="text-body-sm text-muted mb-4">Create a new prescription for dispensing.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            createPrescription.mutate({
              storeId: newPrescription.storeId,
              patientName: newPrescription.patientName || null,
              patientId: newPrescription.patientId || null,
              prescriberName: newPrescription.prescriberName || null,
              prescriberLicense: newPrescription.prescriberLicense || null,
              items: newPrescription.items.map(i => ({ productId: i.productId, quantityPrescribed: i.quantityPrescribed })),
            }, {
              onSuccess: () => {
                setNewPrescription({
                  storeId: '',
                  patientName: '',
                  patientId: '',
                  prescriberName: '',
                  prescriberLicense: '',
                  items: [{ productId: '', quantityPrescribed: '1' }],
                });
                toast.success('Prescription created.');
              },
              onError: (error) => toast.error(error.message),
            });
          }} className="space-y-4">
            <Input label="Store ID" value={newPrescription.storeId} onChange={(e) => setNewPrescription({...newPrescription, storeId: e.target.value})} required />
            <Input label="Patient Name" value={newPrescription.patientName} onChange={(e) => setNewPrescription({...newPrescription, patientName: e.target.value})} />
            <Input label="Prescriber Name" value={newPrescription.prescriberName} onChange={(e) => setNewPrescription({...newPrescription, prescriberName: e.target.value})} />
            <Input label="Prescriber License" value={newPrescription.prescriberLicense} onChange={(e) => setNewPrescription({...newPrescription, prescriberLicense: e.target.value})} />
            <div className="space-y-2">
              <label className="text-body-sm text-primary font-medium">Prescription Items</label>
              {newPrescription.items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start mb-3">
                  <Input label="Product ID" value={item.productId} onChange={(e) => {
                    const n = [...newPrescription.items]; n[index].productId = e.target.value; setNewPrescription({...newPrescription, items: n});
                  }} className="w-48" required />
                  <Input label="Qty" type="number" value={item.quantityPrescribed} onChange={(e) => {
                    const n = [...newPrescription.items]; n[index].quantityPrescribed = e.target.value; setNewPrescription({...newPrescription, items: n});
                  }} className="w-32" required />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setNewPrescription({...newPrescription, items: [...newPrescription.items, { productId: '', quantityPrescribed: '1' }] })}>
                + Add Item
              </Button>
            </div>
            <Button type="submit" variant="primary" size="md" className="w-full" disabled={createPrescription.isPending} isLoading={createPrescription.isPending}>
              Create Prescription
            </Button>
          </form>
        </Card>

        <Card className="col-span-1 lg:col-span-1 p-6 h-full">
          <h2 className="text-heading-h4 text-primary mb-6">Active Prescriptions</h2>
          {(prescriptions?.length ?? 0) === 0 ? (
            <EmptyState title="No prescriptions" description="Create your first prescription." />
          ) : (
            <div className="overflow-y-auto max-h-[400px]">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>RX #</th>
                    <th>Patient</th>
                    <th>Status</th>
                    <th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions!.slice(0, 10).map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-mono text-sm">{p.prescriptionNumber}</td>
                      <td>{p.patientName || '—'}</td>
                      <td>
                        <Badge variant={p.status === 'ACTIVE' ? 'success' : p.status === 'COMPLETED' ? 'warning' : 'danger'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="font-mono tabular-nums">{p.items?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {(expiring?.length ?? 0) > 0 && (
        <Card className="p-6 bg-warning/5 border border-warning/20">
          <h2 className="text-heading-h4 text-warning mb-4">⚠️ Expiring Soon (30 days)</h2>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Batch #</th>
                  <th>Product</th>
                  <th>Expires</th>
                  <th>Days Left</th>
                </tr>
              </thead>
              <tbody>
                {expiring?.slice(0, 5).map((b: any) => (
                  <tr key={b.id}>
                    <td className="font-mono text-sm">{b.batchNumber}</td>
                    <td>{b.productId}</td>
                    <td className="font-mono text-sm">{new Date(b.expiresAt).toLocaleDateString()}</td>
                    <td className="font-mono tabular-nums">
                      {Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
