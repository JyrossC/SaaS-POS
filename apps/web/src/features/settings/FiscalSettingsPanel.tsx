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

type Jurisdiction = 'MAINLAND_TANZANIA' | 'ZANZIBAR';
type SimulationScenario = 'ACCEPTED' | 'REJECTED' | 'TIMEOUT' | 'DUPLICATE' | 'RECOVERED';
type BillingPeriod = 'MONTHLY' | 'ANNUAL';
type PaymentOutcome = 'PAID' | 'FAILED' | 'CANCELED' | 'TIMEOUT';

interface FiscalAddonInvoice {
  id: string;
  amount: string;
  currency: string;
  status: 'DRAFT' | 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'VOIDED';
  isTestMode: true;
  paidAt: string | null;
  createdAt: string;
  payments: Array<{
    id: string;
    status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED';
    amount: string;
    createdAt: string;
  }>;
}

interface FiscalAddonSubscription {
  id: string;
  jurisdiction: Jurisdiction;
  billingPeriod: BillingPeriod;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  amount: string;
  currency: string;
  isTestMode: true;
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  invoices: FiscalAddonInvoice[];
}

interface FiscalSimulationResult {
  simulationOnly: true;
  officialReceiptIssued: false;
  salesRecordCreated: false;
  taxCalculated: false;
  providerContacted: false;
  jurisdiction: Jurisdiction;
  scenario: SimulationScenario;
  outcome:
    | 'SIMULATED_ACCEPTED'
    | 'SIMULATED_REJECTED'
    | 'SIMULATED_TIMEOUT'
    | 'SIMULATED_DUPLICATE'
    | 'SIMULATED_RECOVERED';
  simulationId: string;
  simulatedAt: string;
  message: string;
}

interface Provider {
  id: string;
  jurisdiction: Jurisdiction;
  providerName: string;
  productionEndpoint: string | null;
  sandboxEndpoint: string | null;
  documentationUrl: string | null;
  approvalStatus: 'AUTHORITY_APPROVED';
  isAvailable: true;
}

interface FiscalProfile {
  id: string;
  jurisdiction: Jurisdiction;
  providerConfigurationId: string | null;
  legalName: string | null;
  taxIdentificationNumber: string | null;
  vatRegistrationNumber: string | null;
  credentialsConfigured: boolean;
}

interface FiscalSettings {
  providers: Provider[];
  profiles: FiscalProfile[];
  addonOffer: {
    isAvailable: boolean;
    isTestOnly: true;
    currency: string;
    monthlyPrice: string | null;
    annualPrice: string | null;
  };
  addonRequests: Array<{
    id: string;
    jurisdiction: Jurisdiction;
    status: 'PENDING' | 'CONTACTED' | 'CLOSED';
    message: string | null;
    createdAt: string;
  }>;
  fiscalTransactionsEnabled: false;
  taxCalculationEnabled: false;
  fiscalReceiptIssuanceEnabled: false;
  testBillingEnabled: boolean;
  simulator: { enabled: boolean; mode: 'SIMULATED_ONLY' };
}

interface ProfileForm {
  legalName: string;
  taxIdentificationNumber: string;
  vatRegistrationNumber: string;
  providerConfigurationId: string;
  credentialsJson: string;
  clearCredentials: boolean;
}

const jurisdictions: Array<{ value: Jurisdiction; label: string }> = [
  { value: 'MAINLAND_TANZANIA', label: 'Tanzania Mainland' },
  { value: 'ZANZIBAR', label: 'Zanzibar' },
];

const emptyForm = (): ProfileForm => ({
  legalName: '',
  taxIdentificationNumber: '',
  vatRegistrationNumber: '',
  providerConfigurationId: '',
  credentialsJson: '',
  clearCredentials: false,
});

async function loadFiscalSettings() {
  const response = await apiClient.get<FiscalSettings>('/tenant/fiscalization');
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Could not load fiscal settings.');
  }
  return response.data;
}

async function loadFiscalAddonSubscriptions() {
  const response = await apiClient.get<FiscalAddonSubscription[]>(
    '/tenant/fiscalization/addon-subscriptions',
  );
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Could not load fiscal add-on subscriptions.');
  }
  return response.data;
}

export function FiscalSettingsPanel() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const settingsQuery = useQuery({
    queryKey: ['tenant-fiscalization'],
    queryFn: loadFiscalSettings,
    retry: false,
  });
  const billingQuery = useQuery({
    queryKey: ['tenant-fiscal-addon-subscriptions'],
    queryFn: loadFiscalAddonSubscriptions,
    enabled: settingsQuery.data?.testBillingEnabled === true,
    retry: false,
  });
  const [forms, setForms] = useState<Record<Jurisdiction, ProfileForm>>({
    MAINLAND_TANZANIA: emptyForm(),
    ZANZIBAR: emptyForm(),
  });
  const [pending, setPending] = useState(false);
  const [simulationScenario, setSimulationScenario] = useState<SimulationScenario>('ACCEPTED');
  const [simulationJurisdiction, setSimulationJurisdiction] = useState<Jurisdiction>('MAINLAND_TANZANIA');
  const [simulationResult, setSimulationResult] = useState<FiscalSimulationResult | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('MONTHLY');
  const [checkoutInvoice, setCheckoutInvoice] = useState<FiscalAddonInvoice | null>(null);
  const [paymentResult, setPaymentResult] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setForms((current) => {
      const next = { ...current };
      for (const profile of settingsQuery.data.profiles) {
        next[profile.jurisdiction] = {
          ...next[profile.jurisdiction],
          legalName: profile.legalName ?? '',
          taxIdentificationNumber: profile.taxIdentificationNumber ?? '',
          vatRegistrationNumber: profile.vatRegistrationNumber ?? '',
          providerConfigurationId: profile.providerConfigurationId ?? '',
        };
      }
      return next;
    });
  }, [settingsQuery.data]);

  const updateForm = (jurisdiction: Jurisdiction, patch: Partial<ProfileForm>) => {
    setForms((current) => ({
      ...current,
      [jurisdiction]: { ...current[jurisdiction], ...patch },
    }));
  };

  const saveProfile = async (event: FormEvent, jurisdiction: Jurisdiction) => {
    event.preventDefault();
    const form = forms[jurisdiction];
    setPending(true);
    try {
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
      const response = await apiClient.patch(
        `/tenant/fiscalization/profiles/${jurisdiction}`,
        {
          legalName: form.legalName || null,
          taxIdentificationNumber: form.taxIdentificationNumber || null,
          vatRegistrationNumber: form.vatRegistrationNumber || null,
          providerConfigurationId: form.providerConfigurationId || null,
          ...(credentials ? { credentials } : {}),
          clearCredentials: form.clearCredentials,
        },
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Could not save fiscal profile.');
      }
      toast.success('Fiscal profile saved in configuration-only mode.');
      updateForm(jurisdiction, { credentialsJson: '', clearCredentials: false });
      await queryClient.invalidateQueries({ queryKey: ['tenant-fiscalization'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save fiscal profile.');
    } finally {
      setPending(false);
    }
  };

  const requestAddon = async (jurisdiction: Jurisdiction) => {
    setPending(true);
    try {
      const response = await apiClient.post('/tenant/fiscalization/addon-requests', { jurisdiction });
      if (!response.success) {
        throw new Error(response.error?.message || 'Could not request the fiscalization add-on.');
      }
      toast.success('Add-on request sent. This does not activate service or billing.');
      await queryClient.invalidateQueries({ queryKey: ['tenant-fiscalization'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not request the fiscalization add-on.');
    } finally {
      setPending(false);
    }
  };

  const runSimulation = async () => {
    setPending(true);
    setSimulationResult(null);
    try {
      const response = await apiClient.post<FiscalSimulationResult>(
        '/tenant/fiscalization/simulator/run',
        { jurisdiction: simulationJurisdiction, scenario: simulationScenario },
      );
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not run the fiscal simulator.');
      }
      setSimulationResult(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not run the fiscal simulator.');
    } finally {
      setPending(false);
    }
  };

  const startAddonCheckout = async (jurisdiction: Jurisdiction) => {
    setPending(true);
    setPaymentResult(null);
    try {
      const response = await apiClient.post<FiscalAddonInvoice>(
        '/tenant/fiscalization/addon-subscriptions/checkout',
        { jurisdiction, billingPeriod },
      );
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not start fiscal add-on checkout.');
      }
      setCheckoutInvoice(response.data);
      toast.success('Test invoice created. No real payment was initiated.');
      await queryClient.invalidateQueries({ queryKey: ['tenant-fiscal-addon-subscriptions'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start fiscal add-on checkout.');
    } finally {
      setPending(false);
    }
  };

  const simulateAddonPayment = async (invoiceId: string, outcome: PaymentOutcome) => {
    setPending(true);
    setPaymentResult(null);
    try {
      const response = await apiClient.post<{
        invoice: FiscalAddonInvoice;
        payment: { status: string };
        simulationOnly: true;
        realChargeMade: false;
      }>(`/tenant/fiscalization/addon-invoices/${encodeURIComponent(invoiceId)}/simulate-payment`, {
        outcome,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not simulate the payment result.');
      }
      setCheckoutInvoice(response.data.invoice);
      setPaymentResult(`TEST PAYMENT ${response.data.payment.status} — NO REAL CHARGE`);
      await queryClient.invalidateQueries({ queryKey: ['tenant-fiscal-addon-subscriptions'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not simulate the payment result.');
    } finally {
      setPending(false);
    }
  };

  const updateAddonSubscription = async (
    subscriptionId: string,
    action: 'renew' | 'cancel' | 'resume',
  ) => {
    setPending(true);
    setPaymentResult(null);
    try {
      const response = await apiClient.post<FiscalAddonInvoice | { canceled: boolean }>(
        `/tenant/fiscalization/addon-subscriptions/${encodeURIComponent(subscriptionId)}/${action}`,
        {},
      );
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || `Could not ${action} fiscal add-on subscription.`);
      }
      if (action === 'renew' && 'id' in response.data && 'status' in response.data) {
        setCheckoutInvoice(response.data as FiscalAddonInvoice);
        toast.success('Test renewal invoice created. No real payment was initiated.');
      } else {
        toast.success(action === 'cancel'
          ? 'Test subscription cancellation scheduled.'
          : 'Test subscription renewal resumed.');
      }
      await queryClient.invalidateQueries({ queryKey: ['tenant-fiscal-addon-subscriptions'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not ${action} fiscal add-on subscription.`);
    } finally {
      setPending(false);
    }
  };

  if (settingsQuery.isLoading) return <LoadingState message="Loading fiscal configuration..." />;
  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <ErrorState
        title="Could not load fiscal configuration"
        description={settingsQuery.error instanceof Error
          ? settingsQuery.error.message
          : 'Try again in a moment.'}
        action={<Button type="button" variant="outline" onClick={() => void settingsQuery.refetch()}>Retry</Button>}
      />
    );
  }

  const settings = settingsQuery.data;
  const canUpdate = hasPermission('fiscal_settings.update');

  return (
    <div className="space-y-5">
      <Card>
        <div className="space-y-2">
          <h2 className="text-heading-h3">Fiscal integration setup</h2>
          <p className="text-body-sm text-muted">
            These fields prepare jurisdiction-specific configuration only. Tax calculation, sale completion as a fiscal sale,
            provider calls, and fiscal receipt issuance remain disabled until the required approvals and implementation are complete.
          </p>
        </div>
      </Card>

      {settings.simulator.enabled && (
        <Card>
          <div className="space-y-3">
            <div>
              <h2 className="text-heading-h3">Development fiscal simulator</h2>
              <p className="text-body-sm font-semibold text-danger">
                SIMULATED — NOT AN OFFICIAL FISCAL RECEIPT
              </p>
              <p className="text-body-sm text-muted">
                Synthetic provider outcomes only. This does not contact a provider, calculate tax,
                create a sale, or issue a receipt.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="form-field">
                <span className="text-label-md text-secondary">Jurisdiction</span>
                <select
                  className="input"
                  value={simulationJurisdiction}
                  onChange={(event) => setSimulationJurisdiction(event.target.value as Jurisdiction)}
                  disabled={pending}
                >
                  {jurisdictions.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="text-label-md text-secondary">Synthetic outcome</span>
                <select
                  className="input"
                  value={simulationScenario}
                  onChange={(event) => setSimulationScenario(event.target.value as SimulationScenario)}
                  disabled={pending}
                >
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="TIMEOUT">Timeout</option>
                  <option value="DUPLICATE">Duplicate</option>
                  <option value="RECOVERED">Recovered</option>
                </select>
              </label>
            </div>
            <Button type="button" variant="outline" disabled={pending} onClick={() => void runSimulation()}>
              Run development simulation
            </Button>
            {simulationResult && (
              <div role="status" className="rounded border border-border p-3">
                <p className="font-semibold">SIMULATED — NOT AN OFFICIAL FISCAL RECEIPT</p>
                <p>{simulationResult.outcome}: {simulationResult.message}</p>
                <p className="text-caption text-muted">Simulation ID: {simulationResult.simulationId}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {jurisdictions.map(({ value, label }) => {
        const form = forms[value];
        const profile = settings.profiles.find((item) => item.jurisdiction === value);
        const providers = settings.providers.filter((provider) => provider.jurisdiction === value);
        const hasPendingRequest = settings.addonRequests.some(
          (request) => request.jurisdiction === value && request.status === 'PENDING',
        );
        return (
          <Card key={value}>
            <form className="form-stack max-w-2xl" onSubmit={(event) => void saveProfile(event, value)}>
              <div>
                <h3 className="text-title-md">{label}</h3>
                <p className="text-body-sm text-muted">
                  Provider availability is controlled by platform administrators after approval evidence is verified.
                </p>
              </div>
              <Input
                label="Registered legal name"
                value={form.legalName}
                onChange={(event) => updateForm(value, { legalName: event.target.value })}
                maxLength={200}
                disabled={!canUpdate || pending}
              />
              <Input
                label="Tax identification number"
                value={form.taxIdentificationNumber}
                onChange={(event) => updateForm(value, { taxIdentificationNumber: event.target.value })}
                maxLength={64}
                disabled={!canUpdate || pending}
              />
              <Input
                label="VAT registration number"
                value={form.vatRegistrationNumber}
                onChange={(event) => updateForm(value, { vatRegistrationNumber: event.target.value })}
                maxLength={64}
                disabled={!canUpdate || pending}
              />
              <label className="form-field">
                <span className="text-label-md text-secondary">Approved fiscal provider</span>
                <select
                  className="input"
                  value={form.providerConfigurationId}
                  onChange={(event) => updateForm(value, { providerConfigurationId: event.target.value })}
                  disabled={!canUpdate || pending}
                >
                  <option value="">Not selected</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.providerName}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="text-label-md text-secondary">Provider credentials (JSON)</span>
                <textarea
                  className="input min-h-24 font-mono"
                  value={form.credentialsJson}
                  onChange={(event) => updateForm(value, { credentialsJson: event.target.value })}
                  placeholder={profile?.credentialsConfigured ? 'Saved securely. Leave blank to keep current credentials.' : '{"credentialName":"value"}'}
                  disabled={!canUpdate || pending}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <span className="text-caption text-muted">
                  Credentials are encrypted at rest and never returned. Configure the API encryption key before saving secrets.
                </span>
              </label>
              {profile?.credentialsConfigured && (
                <label className="flex items-center gap-2 text-body-sm">
                  <input
                    type="checkbox"
                    checked={form.clearCredentials}
                    onChange={(event) => updateForm(value, { clearCredentials: event.target.checked })}
                    disabled={!canUpdate || pending}
                  />
                  Clear saved provider credentials
                </label>
              )}
              {canUpdate && <Button type="submit" disabled={pending}>Save {label} configuration</Button>}
            </form>

            {settings.testBillingEnabled && settings.addonOffer.isAvailable && settings.addonOffer.isTestOnly && (
              <section className="mt-5 border-t border-border pt-4">
                <h4 className="text-label-md">Fiscalization add-on · TEST OFFER</h4>
                <p className="mt-1 text-body-sm text-muted">
                  {settings.addonOffer.monthlyPrice
                    ? `${settings.addonOffer.monthlyPrice} ${settings.addonOffer.currency} monthly`
                    : ''}
                  {settings.addonOffer.monthlyPrice && settings.addonOffer.annualPrice ? ' · ' : ''}
                  {settings.addonOffer.annualPrice
                    ? `${settings.addonOffer.annualPrice} ${settings.addonOffer.currency} annually`
                    : ''}
                </p>
                <p className="mt-2 text-body-sm font-semibold text-danger">
                  TEST BILLING ONLY — no real payment, fiscal provider service, tax calculation, or official receipt.
                </p>
                {canUpdate && (
                  <>
                    <label className="form-field mt-3 max-w-xs">
                      <span className="text-label-md text-secondary">Test billing period</span>
                      <select
                        className="input"
                        value={billingPeriod}
                        onChange={(event) => setBillingPeriod(event.target.value as BillingPeriod)}
                        disabled={pending}
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="ANNUAL">Annual</option>
                      </select>
                    </label>
                    <Button type="button" className="mt-3" variant="outline" disabled={pending} onClick={() => void startAddonCheckout(value)}>
                      Start test checkout
                    </Button>
                  </>
                )}
                {billingQuery.isError && (
                  <p role="alert" className="mt-2 text-body-sm text-danger">
                    {billingQuery.error.message}
                  </p>
                )}
                {(billingQuery.data ?? [])
                  .filter((subscription) => subscription.jurisdiction === value)
                  .map((subscription) => (
                    <div className="mt-4 rounded border border-border p-3" key={subscription.id}>
                      <p className="font-semibold">
                        TEST SUBSCRIPTION · {subscription.status} · {subscription.amount} {subscription.currency}/{subscription.billingPeriod.toLowerCase()}
                      </p>
                      {subscription.currentPeriodEndsAt && (
                        <p className="text-body-sm text-muted">
                          Test period ends {new Date(subscription.currentPeriodEndsAt).toLocaleDateString()}
                        </p>
                      )}
                      {subscription.cancelAtPeriodEnd && (
                        <p className="text-body-sm text-danger">Cancellation is scheduled at the end of the test period.</p>
                      )}
                      {subscription.status === 'ACTIVE' && !subscription.cancelAtPeriodEnd && canUpdate && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button type="button" variant="outline" disabled={pending} onClick={() => void updateAddonSubscription(subscription.id, 'renew')}>Create test renewal invoice</Button>
                          <Button type="button" variant="outline" disabled={pending} onClick={() => void updateAddonSubscription(subscription.id, 'cancel')}>Cancel at period end</Button>
                        </div>
                      )}
                      {subscription.status === 'ACTIVE' && subscription.cancelAtPeriodEnd && canUpdate && (
                        <Button type="button" className="mt-2" variant="outline" disabled={pending} onClick={() => void updateAddonSubscription(subscription.id, 'resume')}>Resume test renewal</Button>
                      )}
                      {subscription.invoices.map((invoice) => (
                        <div className="mt-3 border-t border-border pt-2" key={invoice.id}>
                          <p className="text-body-sm">
                            Test invoice {invoice.id}: {invoice.amount} {invoice.currency} · {invoice.status}
                          </p>
                          {invoice.status === 'PENDING_PAYMENT' && canUpdate && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button type="button" size="sm" disabled={pending} onClick={() => void simulateAddonPayment(invoice.id, 'PAID')}>Simulate paid</Button>
                              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void simulateAddonPayment(invoice.id, 'FAILED')}>Simulate failed</Button>
                              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void simulateAddonPayment(invoice.id, 'TIMEOUT')}>Simulate timeout</Button>
                              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void simulateAddonPayment(invoice.id, 'CANCELED')}>Simulate canceled</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                {checkoutInvoice?.status === 'PENDING_PAYMENT' && (
                  <div role="status" className="mt-3 space-y-2 text-body-sm">
                    <p>
                      Current test invoice {checkoutInvoice.id}: {checkoutInvoice.amount} {checkoutInvoice.currency}
                    </p>
                    {canUpdate && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" disabled={pending} onClick={() => void simulateAddonPayment(checkoutInvoice.id, 'PAID')}>Simulate paid</Button>
                        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void simulateAddonPayment(checkoutInvoice.id, 'FAILED')}>Simulate failed</Button>
                        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void simulateAddonPayment(checkoutInvoice.id, 'TIMEOUT')}>Simulate timeout</Button>
                        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void simulateAddonPayment(checkoutInvoice.id, 'CANCELED')}>Simulate canceled</Button>
                      </div>
                    )}
                  </div>
                )}
                {paymentResult && <p role="status" className="mt-2 text-body-sm font-semibold">{paymentResult}</p>}
                <p className="mt-2 text-caption text-muted">
                  Paying this test invoice only changes the simulated add-on billing record. It does not activate fiscal transactions.
                </p>
              </section>
            )}
            {settings.addonOffer.isAvailable && !settings.addonOffer.isTestOnly && providers.length > 0 && (
              <section className="mt-5 border-t border-border pt-4">
                <h4 className="text-label-md">Fiscalization add-on inquiry</h4>
                {hasPendingRequest
                  ? <p className="mt-2 text-body-sm">A request is awaiting platform follow-up.</p>
                  : canUpdate
                    ? <Button type="button" className="mt-3" variant="outline" disabled={pending} onClick={() => void requestAddon(value)}>Request add-on information</Button>
                    : null}
                <p className="mt-2 text-caption text-muted">This inquiry does not create a subscription or charge.</p>
              </section>
            )}
          </Card>
        );
      })}

      <Card>
        <h3 className="text-title-md">Add-on requests</h3>
        {!settings.addonRequests.length ? (
          <p className="mt-2 text-body-sm text-muted">No fiscalization add-on requests.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {settings.addonRequests.map((request) => (
              <li className="text-body-sm" key={request.id}>
                {jurisdictions.find((item) => item.value === request.jurisdiction)?.label} · {request.status} · {new Date(request.createdAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
