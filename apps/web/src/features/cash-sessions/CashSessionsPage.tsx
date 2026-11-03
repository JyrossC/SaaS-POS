import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Badge } from '../../components/ui/Badge';
import { useCashSessions, useOpenCashSession, useCloseCashSession, useStores } from '../../hooks/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../components/auth/AuthProvider';
import { formatBusinessDate, formatBusinessDateTime, formatTzs } from '../../lib/formatters';

export function CashSessionsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sales.create');
  const canOpenSession = canManage && hasPermission('stores.view');
  const { data, isLoading, isError, error } = useCashSessions({ page: 1, pageSize: 100 });
  const storesQuery = useStores(undefined, canOpenSession);
  const stores = storesQuery.data;
  const openSession = useOpenCashSession();
  const closeSession = useCloseCashSession();

  const [storeId, setStoreId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalances, setClosingBalances] = useState<Record<string, string>>({});

  const loading = isLoading || storesQuery.isLoading;
  if (loading) return <LoadingState message="Loading cash sessions..." />;
  if (isError || (canOpenSession && storesQuery.isError)) {
    const requestError = error ?? storesQuery.error;
    return (
      <ErrorState
        title="Could not load cash sessions"
        description={requestError instanceof Error ? requestError.message : 'Try again in a moment.'}
      />
    );
  }

  const storeOptions = stores?.items || [];
  const sessions = data?.items ?? [];
  const activeSessions = sessions.filter((session: any) => session.status === 'OPEN');

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) {
      toast.error('Please select a store');
      return;
    }
    try {
      await openSession.mutateAsync({ storeId, openingBalance });
      toast.success('Cash session opened');
      setStoreId('');
      setOpeningBalance('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to open session');
    }
  };

  const handleClose = async (sessionId: string, balance: string) => {
    try {
      await closeSession.mutateAsync({ sessionId, closingBalance: balance });
      setClosingBalances((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      toast.success('Cash session closed');
    } catch (e: any) {
      toast.error(e.message || 'Failed to close session');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-heading-h1 text-primary">Cash Sessions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canOpenSession && <Card className="col-span-1 lg:col-span-2 p-6">
          <h2 className="text-heading-h4 text-primary mb-6">Open Cash Session</h2>
          <form onSubmit={handleOpen} className="space-y-4">
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
            <Input
              label="Opening Balance"
              type="number"
              min="0"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="lg" isLoading={openSession.isPending} className="w-full" disabled={openSession.isPending || !storeId}>
              Open Session
            </Button>
          </form>
        </Card>}

        <Card className="col-span-1 lg:col-span-1 p-6 h-full">
          <h2 className="text-heading-h4 text-primary mb-6">Active Session</h2>
          {!activeSessions.length ? (
            <div className="text-body-sm text-muted">No active cash sessions.</div>
          ) : (
            <div className="space-y-4">
              {activeSessions.map((session: any) => (
                <div key={session.id} className="active-session">
                  <strong>{session.store?.name || 'Store'}</strong>
                  <span className="text-body-sm text-muted">Opened {formatBusinessDateTime(session.openedAt)}</span>
                  <span className="font-mono tabular-nums">Opening balance: {formatTzs(session.openingBalance)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-heading-h4 text-primary mb-6">Session History</h2>
        {sessions.length === 0 ? (
          <EmptyState title="No cash sessions" description="Open a session to get started." />
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Session</th>
                <th>Store</th>
                <th>Opened</th>
                <th>Status</th>
                <th>Opening</th>
                <th>Closing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((session: any) => (
                <tr key={session.id}>
                  <td className="font-mono text-sm">{session.id.slice(-8)}</td>
                  <td>{session.store?.name || '—'}</td>
                  <td className="text-body-sm text-muted">{formatBusinessDate(session.openedAt)}</td>
                  <td>
                    <Badge variant={session.status === 'OPEN' ? 'success' : 'danger'}>
                      {session.status}
                    </Badge>
                  </td>
                  <td className="font-mono tabular-nums">{formatTzs(session.openingBalance)}</td>
                  <td className="font-mono tabular-nums">
                    {session.closingBalance ? formatTzs(session.closingBalance) : '—'}
                  </td>
                  <td>
                    {session.status === 'OPEN' ? (
                      canManage ? (
                        <div className="cash-close-control">
                          <Input
                            aria-label={`Closing balance for ${session.store?.name || 'session'}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={closingBalances[session.id] ?? String(session.expectedBalance ?? '')}
                            onChange={(event) => setClosingBalances((current) => ({
                              ...current,
                              [session.id]: event.target.value,
                            }))}
                          />
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={closeSession.isPending || (closingBalances[session.id] ?? String(session.expectedBalance ?? '')) === ''}
                            onClick={() => handleClose(session.id, closingBalances[session.id] ?? String(session.expectedBalance ?? ''))}
                          >
                            Close session
                          </Button>
                        </div>
                      ) : <span className="text-body-sm text-muted">Active</span>
                    ) : (
                      <span className="text-body-sm text-muted">Closed</span>
                    )}
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
