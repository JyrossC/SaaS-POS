import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { ApiClient } from '../../lib/api-client';

type Panel = 'plans' | 'admins' | 'support' | 'fiscal';
type SupportScope = 'tenant_profile' | 'stores' | 'products' | 'sales_summary';
type FiscalJurisdiction = 'MAINLAND_TANZANIA' | 'ZANZIBAR';

interface FiscalProvider {
  id: string;
  jurisdiction: FiscalJurisdiction;
  providerName: string;
  productionEndpoint: string | null;
  sandboxEndpoint: string | null;
  documentationUrl: string | null;
  approvalStatus: 'UNVERIFIED' | 'SANDBOX_VALIDATED' | 'AUTHORITY_APPROVED';
  approvalEvidenceReference: string | null;
  isAvailable: boolean;
  credentialsConfigured: boolean;
  updatedAt: string;
}

interface FiscalizationOverview {
  providers: FiscalProvider[];
  addonOffer: {
    id?: string;
    isAvailable: boolean;
    isTestOnly: true;
    currency: string;
    monthlyPrice: string | null;
    annualPrice: string | null;
  };
  addonRequests: Array<{
    id: string;
    tenantId: string;
    jurisdiction: FiscalJurisdiction;
    status: 'PENDING' | 'CONTACTED' | 'CLOSED';
    message: string | null;
    createdAt: string;
    updatedAt: string;
    tenant: Pick<TenantOption, 'id' | 'name' | 'slug'>;
  }>;
  addonSubscriptions: Array<{
    id: string;
    tenantId: string;
    jurisdiction: FiscalJurisdiction;
    billingPeriod: 'MONTHLY' | 'ANNUAL';
    status: 'PENDING_PAYMENT' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
    amount: string;
    currency: string;
    isTestMode: true;
    currentPeriodEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    tenant: Pick<TenantOption, 'id' | 'name' | 'slug'>;
    invoices: Array<{
      id: string;
      amount: string;
      currency: string;
      status: string;
      isTestMode: true;
      paidAt: string | null;
      createdAt: string;
    }>;
  }>;
  testBillingEnabled: boolean;
  fiscalTransactionsEnabled: false;
  taxCalculationEnabled: false;
  fiscalReceiptIssuanceEnabled: false;
}

interface FiscalProviderForm {
  providerName: string;
  productionEndpoint: string;
  sandboxEndpoint: string;
  documentationUrl: string;
  approvalStatus: FiscalProvider['approvalStatus'];
  approvalEvidenceReference: string;
  isAvailable: boolean;
  credentialsJson: string;
  clearCredentials: boolean;
}

const fiscalJurisdictions: Array<{ value: FiscalJurisdiction; label: string }> = [
  { value: 'MAINLAND_TANZANIA', label: 'Tanzania Mainland' },
  { value: 'ZANZIBAR', label: 'Zanzibar' },
];

const emptyFiscalProviderForm = (): FiscalProviderForm => ({
  providerName: '',
  productionEndpoint: '',
  sandboxEndpoint: '',
  documentationUrl: '',
  approvalStatus: 'UNVERIFIED',
  approvalEvidenceReference: '',
  isAvailable: false,
  credentialsJson: '',
  clearCredentials: false,
});

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface PlanEntitlement {
  key: string;
  value: unknown;
}

interface PlanVersion {
  id: string;
  version: number;
  isActive: boolean;
  trialDays: number;
  billingPeriodDays: number;
  currency: string;
  price: string | null;
  entitlements: PlanEntitlement[];
  _count: { subscriptions: number };
}

interface Plan {
  id: string;
  code: string;
  name: string;
  isAvailable: boolean;
  versions: PlanVersion[];
}

interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED';
  mfaEnabled: boolean;
  createdAt: string;
}

interface SupportGrant {
  id: string;
  tenantId?: string;
  tenant?: TenantOption;
  tenantName?: string;
  purpose: string;
  scopes: SupportScope[];
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  events: Array<{
    id: string;
    actorPlatformAdminId: string;
    action: string;
    scope: string | null;
    createdAt: string;
  }>;
}

const scopeOptions: Array<{ value: SupportScope; label: string; description: string }> = [
  { value: 'tenant_profile', label: 'Tenant profile', description: 'Business identity and lifecycle status; no member details or operational totals.' },
  { value: 'stores', label: 'Stores', description: 'Store names, codes, locations, and status.' },
  { value: 'products', label: 'Products', description: 'Product names, SKUs, units, and selling prices; no cost data.' },
  { value: 'sales_summary', label: 'Sales summary', description: 'Aggregate completed-sales totals; no sale or customer details.' },
];

const emptyPlanForm = {
  code: '',
  name: '',
  trialDays: '14',
  billingPeriodDays: '30',
  currency: 'USD',
  price: '0',
  entitlements: '{\n  "pos": true,\n  "products": true,\n  "inventory": true,\n  "stores": true,\n  "staff": true\n}',
};

async function requireData<T>(request: Promise<{ success: boolean; data?: T; error?: { message: string } }>) {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error?.message || 'The platform request failed.');
  }
  return response.data;
}

export function PlatformOperationsPanel({ client }: { client: ApiClient }) {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>('plans');
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [planVersionTarget, setPlanVersionTarget] = useState('');
  const [assignment, setAssignment] = useState({ tenantId: '', planVersionId: '' });
  const [adminInvite, setAdminInvite] = useState({ name: '', email: '' });
  const [supportGrant, setSupportGrant] = useState({
    tenantId: '',
    purpose: '',
    durationMinutes: 30,
    scopes: ['tenant_profile'] as SupportScope[],
  });
  const [selectedGrant, setSelectedGrant] = useState<SupportGrant | null>(null);
  const [supportData, setSupportData] = useState<Array<{ label: string; value: unknown }>>([]);
  const [pending, setPending] = useState(false);
  const [fiscalProviderForms, setFiscalProviderForms] = useState<
    Record<FiscalJurisdiction, FiscalProviderForm>
  >({
    MAINLAND_TANZANIA: emptyFiscalProviderForm(),
    ZANZIBAR: emptyFiscalProviderForm(),
  });
  const [fiscalOfferForm, setFiscalOfferForm] = useState({
    isAvailable: false,
    monthlyPrice: '',
    annualPrice: '',
  });

  const plansQuery = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => requireData<Plan[]>(client.get('/platform/plans')),
    retry: false,
  });
  const adminsQuery = useQuery({
    queryKey: ['platform-admins'],
    queryFn: () => requireData<PlatformAdmin[]>(client.get('/platform/admins')),
    enabled: panel === 'admins',
    retry: false,
  });
  const tenantsQuery = useQuery({
    queryKey: ['platform-support-tenants'],
    queryFn: () => requireData<{ items: TenantOption[] }>(
      client.get('/platform/tenants', { params: { page: 1, pageSize: 100 } }),
    ),
    enabled: panel === 'support' || panel === 'plans',
    retry: false,
  });
  const supportQuery = useQuery({
    queryKey: ['platform-support-access'],
    queryFn: () => requireData<SupportGrant[]>(client.get('/platform/support-access')),
    enabled: panel === 'support',
    retry: false,
  });
  const fiscalQuery = useQuery({
    queryKey: ['platform-fiscalization'],
    queryFn: () => requireData<FiscalizationOverview>(client.get('/platform/fiscalization')),
    enabled: panel === 'fiscal',
    retry: false,
  });

  useEffect(() => {
    if (!fiscalQuery.data) return;
    setFiscalProviderForms((current) => {
      const next = { ...current };
      for (const provider of fiscalQuery.data.providers) {
        next[provider.jurisdiction] = {
          ...next[provider.jurisdiction],
          providerName: provider.providerName,
          productionEndpoint: provider.productionEndpoint ?? '',
          sandboxEndpoint: provider.sandboxEndpoint ?? '',
          documentationUrl: provider.documentationUrl ?? '',
          approvalStatus: provider.approvalStatus,
          approvalEvidenceReference: provider.approvalEvidenceReference ?? '',
          isAvailable: provider.isAvailable,
        };
      }
      return next;
    });
    setFiscalOfferForm({
      isAvailable: fiscalQuery.data.addonOffer.isAvailable,
      monthlyPrice: fiscalQuery.data.addonOffer.monthlyPrice ?? '',
      annualPrice: fiscalQuery.data.addonOffer.annualPrice ?? '',
    });
  }, [fiscalQuery.data]);

  const refreshPanelData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-admins'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-support-access'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-support-tenants'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-fiscalization'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-review-tenants'] }),
    ]);
  };

  const withPending = async (action: () => Promise<void>) => {
    setPending(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The platform request failed.');
    } finally {
      setPending(false);
    }
  };

  const submitPlan = (event: React.FormEvent) => {
    event.preventDefault();
    void withPending(async () => {
      let entitlements: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(planForm.entitlements);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Entitlements must be a JSON object.');
        }
        entitlements = parsed as Record<string, unknown>;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Enter valid entitlement JSON.');
      }

      const version = {
        trialDays: Number(planForm.trialDays),
        billingPeriodDays: Number(planForm.billingPeriodDays),
        currency: planForm.currency.trim().toUpperCase(),
        price: planForm.price.trim() || null,
        entitlements,
      };
      if (planVersionTarget) {
        await requireData(client.post(
          `/platform/plans/${encodeURIComponent(planVersionTarget)}/versions`,
          version,
        ));
        toast.success('New plan version created. Previous versions remain assigned to existing tenants.');
      } else {
        await requireData(client.post('/platform/plans', {
          ...version,
          code: planForm.code,
          name: planForm.name,
        }));
        toast.success('Plan created.');
      }
      setPlanForm(emptyPlanForm);
      setPlanVersionTarget('');
      await refreshPanelData();
    });
  };

  const assignPlan = (event: React.FormEvent) => {
    event.preventDefault();
    void withPending(async () => {
      if (!assignment.tenantId || !assignment.planVersionId) {
        throw new Error('Select a tenant and an available plan version.');
      }
      await requireData(client.put(
        `/platform/tenants/${encodeURIComponent(assignment.tenantId)}/plan`,
        { planVersionId: assignment.planVersionId },
      ));
      toast.success('Tenant subscription updated.');
      await refreshPanelData();
    });
  };

  const inviteAdmin = (event: React.FormEvent) => {
    event.preventDefault();
    void withPending(async () => {
      await requireData(client.post('/platform/admins/invitations', adminInvite));
      toast.success('Administrator invitation sent.');
      setAdminInvite({ name: '', email: '' });
      await queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
    });
  };

  const updateAdminStatus = (admin: PlatformAdmin) => {
    const status = admin.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    void withPending(async () => {
      await requireData(client.patch(
        `/platform/admins/${encodeURIComponent(admin.id)}/status`,
        { status },
      ));
      toast.success(`Administrator ${status === 'ACTIVE' ? 'enabled' : 'disabled'}.`);
      await queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
    });
  };

  const togglePlanAvailability = (plan: Plan) => {
    void withPending(async () => {
      await requireData(client.patch(
        `/platform/plans/${encodeURIComponent(plan.id)}/availability`,
        { isAvailable: !plan.isAvailable },
      ));
      toast.success(`Plan ${plan.isAvailable ? 'disabled' : 'enabled'}.`);
      await queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    });
  };

  const submitSupportGrant = (event: React.FormEvent) => {
    event.preventDefault();
    void withPending(async () => {
      if (!supportGrant.tenantId || supportGrant.scopes.length === 0) {
        throw new Error('Select a tenant and at least one read-only scope.');
      }
      const created = await requireData<SupportGrant>(client.post('/platform/support-access', supportGrant));
      setSelectedGrant(created);
      setSupportData([]);
      setSupportGrant((current) => ({ ...current, purpose: '' }));
      toast.success('Time-limited support access granted.');
      await queryClient.invalidateQueries({ queryKey: ['platform-support-access'] });
    });
  };

  const loadSupportData = async (grant: SupportGrant) => {
    const requests: Array<{ scope: SupportScope; path: string; label: string }> = [
      { scope: 'tenant_profile', path: 'tenant', label: 'Tenant profile' },
      { scope: 'stores', path: 'stores', label: 'Stores' },
      { scope: 'products', path: 'products', label: 'Products (first 100)' },
      { scope: 'sales_summary', path: 'sales-summary', label: 'Sales summary' },
    ];
    await withPending(async () => {
      const records: Array<{ label: string; value: unknown }> = [];
      for (const request of requests) {
        if (grant.scopes.includes(request.scope)) {
          const value = await requireData<unknown>(
            client.get(`/platform/support-access/${encodeURIComponent(grant.id)}/${request.path}`),
          );
          records.push({ label: request.label, value });
        }
      }
      setSelectedGrant(grant);
      setSupportData(records);
    });
  };

  const revokeSupportGrant = (grant: SupportGrant) => {
    void withPending(async () => {
      await requireData(client.delete(`/platform/support-access/${encodeURIComponent(grant.id)}`));
      toast.success('Support access revoked.');
      if (selectedGrant?.id === grant.id) {
        setSelectedGrant(null);
        setSupportData([]);
      }
      await queryClient.invalidateQueries({ queryKey: ['platform-support-access'] });
    });
  };

  const updateFiscalProvider = (
    jurisdiction: FiscalJurisdiction,
    patch: Partial<FiscalProviderForm>,
  ) => {
    setFiscalProviderForms((current) => ({
      ...current,
      [jurisdiction]: { ...current[jurisdiction], ...patch },
    }));
  };

  const saveFiscalProvider = (event: React.FormEvent, jurisdiction: FiscalJurisdiction) => {
    event.preventDefault();
    void withPending(async () => {
      const form = fiscalProviderForms[jurisdiction];
      let credentials: Record<string, string> | undefined;
      if (form.credentialsJson.trim()) {
        const parsed: unknown = JSON.parse(form.credentialsJson);
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed) ||
          !Object.values(parsed).every((value) => typeof value === 'string')
        ) {
          throw new Error('Provider credentials must be a JSON object containing string values.');
        }
        credentials = parsed as Record<string, string>;
      }
      await requireData(client.put(`/platform/fiscalization/providers/${jurisdiction}`, {
        providerName: form.providerName,
        productionEndpoint: form.productionEndpoint || null,
        sandboxEndpoint: form.sandboxEndpoint || null,
        documentationUrl: form.documentationUrl || null,
        approvalStatus: form.approvalStatus,
        approvalEvidenceReference: form.approvalEvidenceReference || null,
        isAvailable: form.isAvailable,
        ...(credentials ? { credentials } : {}),
        clearCredentials: form.clearCredentials,
      }));
      toast.success(`${fiscalJurisdictions.find((item) => item.value === jurisdiction)?.label} provider configuration saved.`);
      updateFiscalProvider(jurisdiction, { credentialsJson: '', clearCredentials: false });
      await queryClient.invalidateQueries({ queryKey: ['platform-fiscalization'] });
    });
  };

  const saveFiscalOffer = (event: React.FormEvent) => {
    event.preventDefault();
    void withPending(async () => {
      await requireData(client.put('/platform/fiscalization/addon-offer', {
        isAvailable: fiscalOfferForm.isAvailable,
        monthlyPrice: fiscalOfferForm.monthlyPrice.trim() || null,
        annualPrice: fiscalOfferForm.annualPrice.trim() || null,
      }));
      toast.success('Fiscal add-on offer configuration saved.');
      await queryClient.invalidateQueries({ queryKey: ['platform-fiscalization'] });
    });
  };

  const updateFiscalRequest = (requestId: string, status: 'CONTACTED' | 'CLOSED') => {
    void withPending(async () => {
      await requireData(client.patch(
        `/platform/fiscalization/addon-requests/${encodeURIComponent(requestId)}`,
        { status },
      ));
      toast.success('Fiscal add-on request updated.');
      await queryClient.invalidateQueries({ queryKey: ['platform-fiscalization'] });
    });
  };

  const tenantOptions = tenantsQuery.data?.items ?? [];
  const availableVersions = (plansQuery.data ?? [])
    .filter((plan) => plan.isAvailable)
    .flatMap((plan) => plan.versions
      .filter((version) => version.isActive)
      .map((version) => ({ plan, version })));

  return (
    <section className="surface-section space-y-6" aria-label="Platform operations">
      <header className="flex flex-wrap gap-2" aria-label="Platform management sections">
        <Button type="button" variant={panel === 'plans' ? 'primary' : 'outline'} onClick={() => setPanel('plans')}>
          Plans and subscriptions
        </Button>
        <Button type="button" variant={panel === 'admins' ? 'primary' : 'outline'} onClick={() => setPanel('admins')}>
          Administrators
        </Button>
        <Button type="button" variant={panel === 'support' ? 'primary' : 'outline'} onClick={() => setPanel('support')}>
          Support access
        </Button>
        <Button type="button" variant={panel === 'fiscal' ? 'primary' : 'outline'} onClick={() => setPanel('fiscal')}>
          Fiscal setup
        </Button>
      </header>

      {panel === 'plans' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-heading-h3">Subscription plans</h2>
            <p className="text-body-sm text-muted">
              Plan versions are immutable once created. New versions apply only to future assignments.
            </p>
          </div>
          {plansQuery.isLoading ? <LoadingState message="Loading subscription plans..." /> : plansQuery.isError ? (
            <ErrorState title="Could not load plans" description={plansQuery.error.message} action={
              <Button type="button" variant="outline" onClick={() => void plansQuery.refetch()}>Retry</Button>
            } />
          ) : !plansQuery.data?.length ? (
            <EmptyState title="No plans configured" description="Create the first subscription plan below." />
          ) : (
            <div className="space-y-3">
              {plansQuery.data.map((plan) => (
                <article className="rounded-lg border border-border p-4" key={plan.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-title-md">{plan.name} <span className="text-muted">({plan.code})</span></h3>
                      <p className="text-body-sm text-muted">{plan.isAvailable ? 'Available' : 'Unavailable for new assignments'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => {
                        setPlanVersionTarget(plan.id);
                        setPlanForm((current) => ({ ...current, code: plan.code, name: plan.name }));
                      }}>
                        Create version
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => togglePlanAvailability(plan)}>
                        {plan.isAvailable ? 'Disable plan' : 'Enable plan'}
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {plan.versions.map((version) => (
                      <li className="text-body-sm text-muted" key={version.id}>
                        Version {version.version}{version.isActive ? ' · current' : ' · historical'} ·
                        {' '}{version.price ?? 'custom'} {version.currency} / {version.billingPeriodDays} days ·
                        {' '}{version.trialDays} trial days · {version._count.subscriptions} subscriptions
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}

          <form className="form-stack max-w-2xl" onSubmit={submitPlan}>
            <h3 className="text-title-md">{planVersionTarget ? 'Create a new plan version' : 'Create a subscription plan'}</h3>
            {!planVersionTarget && (
              <>
                <Input label="Plan code" value={planForm.code} onChange={(event) => setPlanForm((current) => ({ ...current, code: event.target.value }))} maxLength={40} required />
                <Input label="Plan name" value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} required />
              </>
            )}
            {planVersionTarget && (
              <p className="text-body-sm text-muted">
                New version for {(plansQuery.data ?? []).find((plan) => plan.id === planVersionTarget)?.name}.
                <Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => setPlanVersionTarget('')}>Cancel</Button>
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Trial days" type="number" min={0} max={365} value={planForm.trialDays} onChange={(event) => setPlanForm((current) => ({ ...current, trialDays: event.target.value }))} required />
              <Input label="Billing period (days)" type="number" min={1} max={365} value={planForm.billingPeriodDays} onChange={(event) => setPlanForm((current) => ({ ...current, billingPeriodDays: event.target.value }))} required />
              <Input label="Currency" value={planForm.currency} onChange={(event) => setPlanForm((current) => ({ ...current, currency: event.target.value }))} maxLength={3} required />
            </div>
            <Input label="Price" inputMode="decimal" value={planForm.price} onChange={(event) => setPlanForm((current) => ({ ...current, price: event.target.value }))} hint="Use a decimal amount with up to four fractional digits." required />
            <label className="form-field">
              <span className="text-label-md text-muted">Entitlements (JSON object)</span>
              <textarea className="input min-h-32 font-mono" value={planForm.entitlements} onChange={(event) => setPlanForm((current) => ({ ...current, entitlements: event.target.value }))} required />
            </label>
            <Button type="submit" disabled={pending}>{planVersionTarget ? 'Create version' : 'Create plan'}</Button>
          </form>

          <form className="form-stack max-w-2xl border-t border-border pt-5" onSubmit={assignPlan}>
            <h3 className="text-title-md">Assign a plan to a tenant</h3>
            {tenantsQuery.isError ? <ErrorState title="Could not load tenants" description={tenantsQuery.error.message} /> : null}
            <label className="form-field">
              <span className="text-label-md text-muted">Tenant</span>
              <select className="input" value={assignment.tenantId} onChange={(event) => setAssignment((current) => ({ ...current, tenantId: event.target.value }))} required>
                <option value="">Select a tenant</option>
                {tenantOptions.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name} · {tenant.slug} · {tenant.status}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="text-label-md text-muted">Available plan version</span>
              <select className="input" value={assignment.planVersionId} onChange={(event) => setAssignment((current) => ({ ...current, planVersionId: event.target.value }))} required>
                <option value="">Select a plan version</option>
                {availableVersions.map(({ plan, version }) => (
                  <option value={version.id} key={version.id}>{plan.name} v{version.version} · {version.price ?? 'custom'} {version.currency}</option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={pending}>Assign plan</Button>
          </form>
        </div>
      )}

      {panel === 'admins' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-heading-h3">Platform administrators</h2>
            <p className="text-body-sm text-muted">
              All active platform administrators have platform-wide authority and must enroll in MFA before signing in.
            </p>
          </div>
          {adminsQuery.isLoading ? <LoadingState message="Loading administrators..." /> : adminsQuery.isError ? (
            <ErrorState title="Could not load administrators" description={adminsQuery.error.message} action={
              <Button type="button" variant="outline" onClick={() => void adminsQuery.refetch()}>Retry</Button>
            } />
          ) : (
            <div className="space-y-2">
              {(adminsQuery.data ?? []).map((admin) => (
                <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4" key={admin.id}>
                  <div>
                    <h3 className="text-title-md">{admin.name}</h3>
                    <p className="text-body-sm text-muted">{admin.email} · {admin.status} · MFA {admin.mfaEnabled ? 'enabled' : 'required'}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => updateAdminStatus(admin)}>
                    {admin.status === 'ACTIVE' ? 'Disable access' : 'Enable access'}
                  </Button>
                </article>
              ))}
            </div>
          )}
          <form className="form-stack max-w-xl border-t border-border pt-5" onSubmit={inviteAdmin}>
            <h3 className="text-title-md">Invite an administrator</h3>
            <Input label="Name" value={adminInvite.name} onChange={(event) => setAdminInvite((current) => ({ ...current, name: event.target.value }))} maxLength={120} required />
            <Input label="Email" type="email" value={adminInvite.email} onChange={(event) => setAdminInvite((current) => ({ ...current, email: event.target.value }))} required />
            <p className="text-body-sm text-muted">A one-time, 24-hour password setup link will be delivered by email.</p>
            <Button type="submit" disabled={pending}>Send invitation</Button>
          </form>
        </div>
      )}

      {panel === 'fiscal' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-heading-h3">Fiscal provider and add-on setup</h2>
            <p className="text-body-sm text-muted">
              Provider configuration is preparatory only. The development/test billing simulator can create test
              invoices and payment-state records, but never real charges. No provider adapter submits transactions,
              calculates tax, or issues fiscal receipts.
              Approval status must be backed by documented evidence.
            </p>
          </div>
          {fiscalQuery.isLoading ? <LoadingState message="Loading fiscal setup..." /> : fiscalQuery.isError ? (
            <ErrorState title="Could not load fiscal setup" description={fiscalQuery.error.message} action={
              <Button type="button" variant="outline" onClick={() => void fiscalQuery.refetch()}>Retry</Button>
            } />
          ) : (
            <>
              {fiscalJurisdictions.map(({ value, label }) => {
                const form = fiscalProviderForms[value];
                const provider = fiscalQuery.data?.providers.find((item) => item.jurisdiction === value);
                return (
                  <form className="form-stack max-w-3xl rounded-lg border border-border p-4" key={value} onSubmit={(event) => saveFiscalProvider(event, value)}>
                    <div>
                      <h3 className="text-title-md">{label} provider</h3>
                      <p className="text-caption text-muted">
                        Credentials: {provider?.credentialsConfigured ? 'saved encrypted' : 'not saved'} ·
                        {' '}Last updated: {provider ? new Date(provider.updatedAt).toLocaleString() : 'not configured'}
                      </p>
                    </div>
                    <Input label="Provider name" value={form.providerName} onChange={(event) => updateFiscalProvider(value, { providerName: event.target.value })} maxLength={120} required disabled={pending} />
                    <Input label="Production endpoint (HTTPS)" type="url" value={form.productionEndpoint} onChange={(event) => updateFiscalProvider(value, { productionEndpoint: event.target.value })} disabled={pending} />
                    <Input label="Sandbox endpoint (HTTPS)" type="url" value={form.sandboxEndpoint} onChange={(event) => updateFiscalProvider(value, { sandboxEndpoint: event.target.value })} disabled={pending} />
                    <Input label="Official documentation URL (HTTPS)" type="url" value={form.documentationUrl} onChange={(event) => updateFiscalProvider(value, { documentationUrl: event.target.value })} disabled={pending} />
                    <label className="form-field">
                      <span className="text-label-md text-secondary">Approval evidence status</span>
                      <select className="input" value={form.approvalStatus} onChange={(event) => updateFiscalProvider(value, { approvalStatus: event.target.value as FiscalProviderForm['approvalStatus'] })} disabled={pending}>
                        <option value="UNVERIFIED">Unverified</option>
                        <option value="SANDBOX_VALIDATED">Sandbox validated</option>
                        <option value="AUTHORITY_APPROVED">Authority approved</option>
                      </select>
                    </label>
                    <Input label="Approval evidence reference" value={form.approvalEvidenceReference} onChange={(event) => updateFiscalProvider(value, { approvalEvidenceReference: event.target.value })} maxLength={500} disabled={pending || form.approvalStatus !== 'AUTHORITY_APPROVED'} />
                    <label className="flex items-center gap-2 text-body-sm">
                      <input type="checkbox" checked={form.isAvailable} onChange={(event) => updateFiscalProvider(value, { isAvailable: event.target.checked })} disabled={pending} />
                      Make provider available for tenant configuration
                    </label>
                    <label className="form-field">
                      <span className="text-label-md text-secondary">Provider credentials (JSON)</span>
                      <textarea className="input min-h-24 font-mono" value={form.credentialsJson} onChange={(event) => updateFiscalProvider(value, { credentialsJson: event.target.value })} placeholder={provider?.credentialsConfigured ? 'Saved securely. Leave blank to keep current credentials.' : '{"credentialName":"value"}'} disabled={pending} autoComplete="new-password" spellCheck={false} />
                      <span className="text-caption text-muted">Encrypted at rest; never returned. Configure FISCAL_CREDENTIAL_ENCRYPTION_KEY before saving credentials.</span>
                    </label>
                    {provider?.credentialsConfigured && (
                      <label className="flex items-center gap-2 text-body-sm">
                        <input type="checkbox" checked={form.clearCredentials} onChange={(event) => updateFiscalProvider(value, { clearCredentials: event.target.checked })} disabled={pending} />
                        Clear saved provider credentials
                      </label>
                    )}
                    <Button type="submit" disabled={pending}>Save provider configuration</Button>
                  </form>
                );
              })}

              <form className="form-stack max-w-3xl rounded-lg border border-border p-4" onSubmit={saveFiscalOffer}>
                <h3 className="text-title-md">Fiscalization add-on offer</h3>
                <p className="text-body-sm font-semibold text-danger">
                  TEST-ONLY OFFER. No live payments, fiscal provider service, tax calculation, or official receipts are enabled.
                </p>
                <p className="text-body-sm text-muted">
                  Test catalog values are TZS 35,000 monthly and TZS 400,000 annually. This offer is only visible and purchasable in development/test when the test billing flag is enabled. Live pricing, provider selection, and charging remain blocked pending approval.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Test monthly price (TZS)" inputMode="decimal" value={fiscalOfferForm.monthlyPrice} onChange={(event) => setFiscalOfferForm((current) => ({ ...current, monthlyPrice: event.target.value }))} disabled={pending || !fiscalQuery.data?.testBillingEnabled} />
                  <Input label="Test annual price (TZS)" inputMode="decimal" value={fiscalOfferForm.annualPrice} onChange={(event) => setFiscalOfferForm((current) => ({ ...current, annualPrice: event.target.value }))} disabled={pending || !fiscalQuery.data?.testBillingEnabled} />
                </div>
                <label className="flex items-center gap-2 text-body-sm">
                  <input type="checkbox" checked={fiscalOfferForm.isAvailable} onChange={(event) => setFiscalOfferForm((current) => ({ ...current, isAvailable: event.target.checked }))} disabled={pending || !fiscalQuery.data?.testBillingEnabled} />
                  Publish test offer to development/test tenants
                </label>
                {!fiscalQuery.data?.testBillingEnabled && (
                  <p className="text-body-sm text-muted">
                    Enable FISCAL_ADDON_TEST_BILLING_ENABLED=true in a development/test environment to manage the test offer. Production rejects this flag.
                  </p>
                )}
                <Button type="submit" disabled={pending || !fiscalQuery.data?.testBillingEnabled}>Save test offer</Button>
              </form>

              <section className="space-y-3">
                <h3 className="text-title-md">Fiscal add-on test subscriptions</h3>
                {!fiscalQuery.data?.addonSubscriptions.length ? (
                  <EmptyState title="No test subscriptions" description="Test-only billing records will appear here. They are separate from live fiscal processing." />
                ) : fiscalQuery.data.addonSubscriptions.map((subscription) => (
                  <article className="rounded-lg border border-border p-4" key={subscription.id}>
                    <h4 className="text-title-md">
                      TEST ONLY · {subscription.tenant.name} · {fiscalJurisdictions.find((item) => item.value === subscription.jurisdiction)?.label}
                    </h4>
                    <p className="text-body-sm text-muted">
                      {subscription.status} · {subscription.amount} {subscription.currency}/{subscription.billingPeriod.toLowerCase()}
                      {subscription.currentPeriodEndsAt
                        ? ` · period ends ${new Date(subscription.currentPeriodEndsAt).toLocaleDateString()}`
                        : ''}
                      {subscription.cancelAtPeriodEnd ? ' · cancellation scheduled' : ''}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {subscription.invoices.map((invoice) => (
                        <li className="text-body-sm text-muted" key={invoice.id}>
                          Test invoice {invoice.id} · {invoice.amount} {invoice.currency} · {invoice.status}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </section>

              <section className="space-y-3">
                <h3 className="text-title-md">Tenant add-on inquiries</h3>
                {!fiscalQuery.data?.addonRequests.length ? (
                  <EmptyState title="No add-on inquiries" description="Tenant inquiries will appear here after the offer is published." />
                ) : fiscalQuery.data.addonRequests.map((request) => (
                  <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4" key={request.id}>
                    <div>
                      <h4 className="text-title-md">{request.tenant.name} · {fiscalJurisdictions.find((item) => item.value === request.jurisdiction)?.label}</h4>
                      <p className="text-body-sm text-muted">{request.status} · {new Date(request.createdAt).toLocaleString()}</p>
                      {request.message && <p className="text-body-sm">{request.message}</p>}
                    </div>
                    {request.status !== 'CLOSED' && (
                      <div className="flex gap-2">
                        {request.status === 'PENDING' && <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => updateFiscalRequest(request.id, 'CONTACTED')}>Mark contacted</Button>}
                        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => updateFiscalRequest(request.id, 'CLOSED')}>Close inquiry</Button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            </>
          )}
        </div>
      )}

      {panel === 'support' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-heading-h3">Read-only support access</h2>
            <p className="text-body-sm text-muted">
              Access is granted to one tenant, only for selected data scopes, and expires within 60 minutes.
              Tenant member identities, customer records, individual sales, and all write actions are excluded.
            </p>
          </div>
          <form className="form-stack max-w-2xl" onSubmit={submitSupportGrant}>
            <label className="form-field">
              <span className="text-label-md text-muted">Tenant</span>
              <select className="input" value={supportGrant.tenantId} onChange={(event) => setSupportGrant((current) => ({ ...current, tenantId: event.target.value }))} required>
                <option value="">Select a tenant</option>
                {tenantOptions.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name} · {tenant.slug} · {tenant.status}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span className="text-label-md text-muted">Purpose and support case reference</span>
              <textarea className="input min-h-24" minLength={10} maxLength={1000} value={supportGrant.purpose} onChange={(event) => setSupportGrant((current) => ({ ...current, purpose: event.target.value }))} required />
            </label>
            <label className="form-field">
              <span className="text-label-md text-muted">Access duration</span>
              <select className="input" value={supportGrant.durationMinutes} onChange={(event) => setSupportGrant((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}>
                {[5, 15, 30, 60].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
            <fieldset className="form-stack">
              <legend className="text-label-md">Explicit read-only scopes</legend>
              {scopeOptions.map((scope) => (
                <label className="flex items-start gap-3" key={scope.value}>
                  <input
                    type="checkbox"
                    checked={supportGrant.scopes.includes(scope.value)}
                    onChange={(event) => setSupportGrant((current) => ({
                      ...current,
                      scopes: event.target.checked
                        ? [...current.scopes, scope.value]
                        : current.scopes.filter((item) => item !== scope.value),
                    }))}
                  />
                  <span><span className="text-label-md">{scope.label}</span><span className="block text-body-sm text-muted">{scope.description}</span></span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={pending}>Grant support access</Button>
          </form>

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-title-md">Your support-access grants</h3>
            {supportQuery.isLoading ? <LoadingState message="Loading support grants..." /> : supportQuery.isError ? (
              <ErrorState title="Could not load grants" description={supportQuery.error.message} action={
                <Button type="button" variant="outline" onClick={() => void supportQuery.refetch()}>Retry</Button>
              } />
            ) : !supportQuery.data?.length ? (
              <EmptyState title="No grants created" description="Support access grants are visible only to the platform administrator who created them." />
            ) : (
              supportQuery.data.map((grant) => (
                <article className="rounded-lg border border-border p-4" key={grant.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-title-md">{grant.tenant?.name ?? grant.tenantName ?? 'Tenant'} · {grant.status}</h4>
                      <p className="text-body-sm text-muted">{grant.purpose}</p>
                      <p className="text-caption text-muted">Scopes: {grant.scopes.join(', ')} · Expires {new Date(grant.expiresAt).toLocaleString()}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-caption text-muted">Immutable access history ({grant.events.length})</summary>
                        <ul className="mt-2 space-y-1">
                          {grant.events.map((event) => (
                            <li className="text-caption text-muted" key={event.id}>
                              {event.action}{event.scope ? ` · ${event.scope}` : ''} · {new Date(event.createdAt).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                    <div className="flex gap-2">
                      {grant.status === 'ACTIVE' && (
                        <>
                          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void loadSupportData(grant)}>View scoped data</Button>
                          <Button type="button" variant="danger" size="sm" disabled={pending} onClick={() => revokeSupportGrant(grant)}>Revoke</Button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          {selectedGrant && (
            <section className="space-y-3 border-t border-border pt-5" aria-label="Scoped support data">
              <h3 className="text-title-md">Read-only data: {selectedGrant.tenantName ?? selectedGrant.tenant?.name ?? 'Tenant'}</h3>
              {!supportData.length ? <LoadingState message="Loading authorized support data..." /> : supportData.map((record) => (
                <details className="rounded-lg border border-border p-4" open key={record.label}>
                  <summary className="cursor-pointer text-label-md">{record.label}</summary>
                  <pre className="mt-3 overflow-auto whitespace-pre-wrap text-body-sm">{JSON.stringify(record.value, null, 2)}</pre>
                </details>
              ))}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
