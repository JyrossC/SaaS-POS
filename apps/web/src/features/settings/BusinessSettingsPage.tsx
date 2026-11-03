import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { apiClient } from '../../lib/api-client';
import { FiscalSettingsPanel } from './FiscalSettingsPanel';

interface BusinessSettings {
  id: string;
  name: string;
  businessType: 'RETAIL' | 'PHARMACY' | 'HYBRID';
  businessAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currency: 'TZS';
  timezone: 'Africa/Dar_es_Salaam';
  taxEnabled: false;
  taxStatus: 'DISABLED_PENDING_REVIEW';
  receiptSettingsStatus: 'PENDING_LEGAL_REVIEW';
  notificationSettingsStatus: 'NOT_CONFIGURED';
  integrationsStatus: 'NOT_CONFIGURED';
}

interface BusinessProfileForm {
  name: string;
  businessAddress: string;
  contactEmail: string;
  contactPhone: string;
}

async function loadSettings() {
  const response = await apiClient.get<BusinessSettings>('/tenant/settings');
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Could not load business settings.');
  }
  return response.data;
}

export function BusinessSettingsPage() {
  const queryClient = useQueryClient();
  const { hasPermission, updateTenantName } = useAuth();
  const settingsQuery = useQuery({
    queryKey: ['tenant-business-settings'],
    queryFn: loadSettings,
    retry: false,
  });
  const [form, setForm] = useState<BusinessProfileForm>({
    name: '',
    businessAddress: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        name: settingsQuery.data.name,
        businessAddress: settingsQuery.data.businessAddress ?? '',
        contactEmail: settingsQuery.data.contactEmail ?? '',
        contactPhone: settingsQuery.data.contactPhone ?? '',
      });
    }
  }, [settingsQuery.data]);

  const updateProfile = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      const response = await apiClient.patch<BusinessSettings>('/tenant/settings', {
        name: form.name,
        businessAddress: form.businessAddress,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
      });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not save business profile.');
      }
      queryClient.setQueryData(['tenant-business-settings'], response.data);
      updateTenantName(response.data.name);
      toast.success('Business profile saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save business profile.');
    } finally {
      setPending(false);
    }
  };

  if (settingsQuery.isLoading) {
    return <LoadingState message="Loading business settings..." />;
  }
  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <ErrorState
        title="Could not load business settings"
        description={settingsQuery.error instanceof Error
          ? settingsQuery.error.message
          : 'Try again in a moment.'}
        action={<Button type="button" variant="outline" onClick={() => void settingsQuery.refetch()}>Retry</Button>}
      />
    );
  }

  const settings = settingsQuery.data;
  const canUpdate = hasPermission('business_settings.update');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-heading-h2">Business settings</h1>
        <p className="mt-2 text-body-md text-muted">
          Maintain your business profile and review the settings currently approved for the Tanzania launch.
        </p>
      </header>

      <Card>
        <form className="form-stack max-w-2xl" onSubmit={(event) => void updateProfile(event)}>
          <div>
            <h2 className="text-heading-h3">Business profile</h2>
            <p className="mt-1 text-body-sm text-muted">
              Profile changes are recorded in the tenant audit history.
            </p>
          </div>
          <Input
            label="Business name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            maxLength={120}
            required
            disabled={!canUpdate || pending}
          />
          <label className="form-field">
            <span className="text-label-md text-secondary">Business address</span>
            <textarea
              className="input min-h-24"
              value={form.businessAddress}
              onChange={(event) => setForm((current) => ({ ...current, businessAddress: event.target.value }))}
              maxLength={500}
              disabled={!canUpdate || pending}
            />
          </label>
          <Input
            label="Business contact email"
            type="email"
            value={form.contactEmail}
            onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
            maxLength={254}
            disabled={!canUpdate || pending}
          />
          <Input
            label="Business contact phone"
            type="tel"
            value={form.contactPhone}
            onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
            maxLength={40}
            disabled={!canUpdate || pending}
          />
          {canUpdate && <Button type="submit" disabled={pending} isLoading={pending}>Save business profile</Button>}
        </form>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-heading-h3">Locale and tax policy</h2>
            <p className="mt-1 text-body-sm text-muted">
              These launch values follow the approved product baseline and cannot be changed here.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-label-sm text-muted">Currency</dt>
              <dd className="text-body-md text-primary">{settings.currency}</dd>
            </div>
            <div>
              <dt className="text-label-sm text-muted">Business timezone</dt>
              <dd className="text-body-md text-primary">{settings.timezone}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-label-sm text-muted">Tax</dt>
              <dd className="text-body-md text-primary">
                Disabled pending Tanzania tax/legal review; prices remain tax-exclusive.
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-heading-h3">Additional configuration</h2>
            <p className="mt-1 text-body-sm text-muted">
              Operational receipt, notification, and integration workflows remain gated. Fiscal-provider metadata setup is available below in configuration-only mode.
            </p>
          </div>
          <ul className="space-y-2 text-body-sm text-secondary">
            <li>Statutory receipt preferences: pending legal review.</li>
            <li>Notification preferences: no tenant notification-delivery workflow is configured.</li>
            <li>Live tenant integrations: no operational provider integration workflow is configured.</li>
            <li>Brand assets and transaction numbering: remain in the relevant product-design gates.</li>
          </ul>
        </div>
      </Card>

      {hasPermission('fiscal_settings.view') && <FiscalSettingsPanel />}
    </div>
  );
}
