import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ApiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { PlatformOperationsPanel } from './PlatformOperationsPanel';

type TenantStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

interface TenantDocument {
  id: string;
  documentName: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  reviewStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: string;
}

interface ReviewEvent {
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ReviewTenant {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  status: TenantStatus;
  createdAt: string;
  memberships: Array<{ status: string; user: { name: string; email: string } }>;
  subscription: { status: string; planVersion?: { plan: { code: string; name: string } } } | null;
  kybDocuments: TenantDocument[];
  reviewEvents: ReviewEvent[];
}

interface TenantList {
  items: ReviewTenant[];
  total: number;
  page: number;
  pageSize: number;
}

const platformClient = new ApiClient('/platform/auth/refresh', 'platform-auth-expired');
const STATUS_OPTIONS: Array<{ value: TenantStatus | ''; label: string }> = [
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

export function PlatformReviewPage() {
  const queryClient = useQueryClient();
  const [installationStatus, setInstallationStatus] = useState<'loading' | 'uninitialized' | 'initialized' | 'error'>('loading');
  const [installationStatusError, setInstallationStatusError] = useState('');
  const [installationError, setInstallationError] = useState('');
  const [installationComplete, setInstallationComplete] = useState(false);
  const [installationPending, setInstallationPending] = useState(false);
  const [platformSessionRestoring, setPlatformSessionRestoring] = useState(true);
  const [installationForm, setInstallationForm] = useState({
    platformName: '',
    adminName: '',
    adminEmail: '',
    password: '',
    installationSecret: '',
  });
  const [admin, setAdmin] = useState<{ name: string; email: string } | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [mfaSetupPending, setMfaSetupPending] = useState(false);
  const [mfaChallengeRequired, setMfaChallengeRequired] = useState(false);
  const [mfaSetupToken, setMfaSetupToken] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaProvisioningUri, setMfaProvisioningUri] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TenantStatus | ''>('PENDING_REVIEW');
  const [page, setPage] = useState(1);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({});
  const [actionPending, setActionPending] = useState(false);
  const [showManagement, setShowManagement] = useState(false);

  const checkInstallationStatus = async () => {
    setInstallationStatus('loading');
    setInstallationStatusError('');
    try {
      const response = await platformClient.get<{ initialized: boolean }>('/installation/status');
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not check platform setup status.');
      }
      setInstallationStatus(response.data.initialized ? 'initialized' : 'uninitialized');
    } catch (requestError) {
      setInstallationStatus('error');
      setInstallationStatusError(
        requestError instanceof Error ? requestError.message : 'Could not check platform setup status.',
      );
    }
  };

  useEffect(() => {
    void checkInstallationStatus();
  }, []);

  useEffect(() => {
    let active = true;
    void platformClient.post<{
      accessToken: string;
      platformAdmin: { name: string; email: string };
    }>('/platform/auth/refresh')
      .then((response) => {
        if (!active) return;
        if (response.success && response.data?.accessToken && response.data.platformAdmin) {
          platformClient.setToken(response.data.accessToken);
          setAdmin(response.data.platformAdmin);
        } else if (response.error?.status && response.error.status !== 401) {
          setLoginError(response.error.message || 'Could not restore the platform session.');
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setLoginError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not restore the platform session.',
          );
        }
      })
      .finally(() => {
        if (active) setPlatformSessionRestoring(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const query = useQuery({
    queryKey: ['platform-review-tenants', status, search, page],
    enabled: Boolean(admin),
    queryFn: async () => {
      const response = await platformClient.get<TenantList>('/platform/tenants', {
        params: { status: status || undefined, search: search || undefined, page, pageSize: 20 },
      });
      if (!response.success || !response.data) {
        if (response.error?.status === 401) signOut();
        throw new Error(response.error?.message || 'Could not load tenant applications.');
      }
      return response.data;
    },
    retry: false,
  });

  const pageCount = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20));
  const visibleRange = useMemo(() => {
    const total = query.data?.total ?? 0;
    return total === 0 ? '0 applications' : `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}`;
  }, [page, query.data?.total]);

  function clearPlatformSession() {
    platformClient.setToken(null);
    setAdmin(null);
    setPassword('');
    setMfaCode('');
    setMfaChallengeRequired(false);
    setMfaSetupToken(null);
    setMfaSecret(null);
    setMfaProvisioningUri(null);
    setRecoveryCodes(null);
    queryClient.removeQueries({ queryKey: ['platform-review-tenants'] });
  }

  async function signOut(revokeSession = true) {
    let signOutError: string | null = null;
    if (revokeSession && platformClient.getToken()) {
      try {
        const response = await platformClient.post<{ loggedOut: boolean }>('/platform/auth/logout');
        if (!response.success && response.error?.status !== 401) {
          signOutError = response.error?.message || 'Could not revoke the platform session.';
        }
      } catch (requestError) {
        signOutError = requestError instanceof Error
          ? requestError.message
          : 'Could not revoke the platform session.';
      }
    }
    clearPlatformSession();
    if (signOutError) toast.error(signOutError);
  }

  useEffect(() => {
    const handleExpiredSession = () => clearPlatformSession();
    window.addEventListener('platform-auth-expired', handleExpiredSession);
    return () => window.removeEventListener('platform-auth-expired', handleExpiredSession);
  }, [queryClient]);

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginPending(true);
    setLoginError('');
    try {
      const response = await platformClient.post<{
        accessToken?: string;
        mfaSetupRequired?: true;
        setupToken?: string;
        platformAdmin: { name: string; email: string };
        recoveryCodes?: string[];
      }>('/platform/auth/login', {
        email: email.trim(),
        password,
        ...(mfaCode ? { mfaCode } : {}),
      });
      if (!response.success || !response.data) {
        const message = response.error?.message || 'Platform sign-in failed.';
        if (message.toLowerCase().includes('multi-factor code')) {
          setMfaChallengeRequired(true);
        }
        throw new Error(message);
      }
      if (response.data.mfaSetupRequired && response.data.setupToken) {
        setMfaSetupToken(response.data.setupToken);
        setPassword('');
        await beginMfaSetup(response.data.setupToken);
        return;
      }
      if (!response.data.accessToken) {
        throw new Error('Platform sign-in did not return an authenticated session.');
      }
      platformClient.setToken(response.data.accessToken);
      setAdmin(response.data.platformAdmin);
      setPassword('');
      setMfaCode('');
      setMfaChallengeRequired(false);
      setRecoveryCodes(response.data.recoveryCodes ?? null);
      await queryClient.invalidateQueries({ queryKey: ['platform-review-tenants'] });
    } catch (requestError) {
      setLoginError(requestError instanceof Error ? requestError.message : 'Platform sign-in failed.');
    } finally {
      setLoginPending(false);
    }
  };

  const beginMfaSetup = async (setupToken: string) => {
    setMfaSetupPending(true);
    setLoginError('');
    try {
      const response = await platformClient.post<{
        secret: string;
        provisioningUri: string;
      }>('/platform/auth/mfa/setup', { setupToken });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not begin MFA setup.');
      }
      setMfaSecret(response.data.secret);
      setMfaProvisioningUri(response.data.provisioningUri);
    } catch (requestError) {
      setLoginError(requestError instanceof Error ? requestError.message : 'Could not begin MFA setup.');
    } finally {
      setMfaSetupPending(false);
    }
  };

  const submitMfaConfirmation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mfaSetupToken) return;
    setMfaSetupPending(true);
    setLoginError('');
    try {
      const response = await platformClient.post<{
        accessToken: string;
        platformAdmin: { name: string; email: string };
        recoveryCodes: string[];
      }>('/platform/auth/mfa/confirm', {
        setupToken: mfaSetupToken,
        code: mfaCode.trim(),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not confirm MFA setup.');
      }
      platformClient.setToken(response.data.accessToken);
      setAdmin(response.data.platformAdmin);
      setRecoveryCodes(response.data.recoveryCodes);
      setMfaSetupToken(null);
      setMfaSecret(null);
      setMfaProvisioningUri(null);
      setMfaCode('');
      await queryClient.invalidateQueries({ queryKey: ['platform-review-tenants'] });
    } catch (requestError) {
      setLoginError(requestError instanceof Error ? requestError.message : 'Could not confirm MFA setup.');
    } finally {
      setMfaSetupPending(false);
    }
  };

  const submitInstallation = async (event: React.FormEvent) => {
    event.preventDefault();
    setInstallationPending(true);
    setInstallationError('');
    try {
      const response = await platformClient.post<{ initialized: true; platformName: string }>(
        '/installation/initialize',
        {
          platformName: installationForm.platformName.trim(),
          adminName: installationForm.adminName.trim(),
          adminEmail: installationForm.adminEmail.trim(),
          password: installationForm.password,
        },
        { headers: { 'X-Installation-Secret': installationForm.installationSecret } },
      );
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not initialize the platform.');
      }
      setInstallationStatus('initialized');
      setInstallationComplete(true);
      setEmail(installationForm.adminEmail.trim());
      setInstallationForm({
        platformName: '',
        adminName: '',
        adminEmail: '',
        password: '',
        installationSecret: '',
      });
    } catch (requestError) {
      setInstallationError(
        requestError instanceof Error ? requestError.message : 'Could not initialize the platform.',
      );
    } finally {
      setInstallationPending(false);
    }
  };

  const postAction = async (tenantId: string, action: 'approve' | 'reject', body?: unknown) => {
    setActionPending(true);
    try {
      const response = await platformClient.post(`/platform/tenants/${encodeURIComponent(tenantId)}/${action}`, body);
      if (!response.success) {
        throw new Error(response.error?.message || `Could not ${action} tenant.`);
      }
      toast.success(action === 'approve' ? 'Tenant approved.' : 'Tenant rejected.');
      setRejectionReasons((current) => ({ ...current, [tenantId]: '' }));
      await queryClient.invalidateQueries({ queryKey: ['platform-review-tenants'] });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : `Could not ${action} tenant.`);
    } finally {
      setActionPending(false);
    }
  };

  const updateTenantStatus = async (tenantId: string, status: 'ACTIVE' | 'SUSPENDED') => {
    setActionPending(true);
    try {
      const response = await platformClient.patch(
        `/platform/tenants/${encodeURIComponent(tenantId)}/status`,
        { status },
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Could not update tenant status.');
      }
      toast.success(status === 'SUSPENDED' ? 'Tenant suspended.' : 'Tenant reactivated.');
      await queryClient.invalidateQueries({ queryKey: ['platform-review-tenants'] });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not update tenant status.');
    } finally {
      setActionPending(false);
    }
  };

  const reviewDocument = async (
    tenantId: string,
    documentId: string,
    reviewStatus: 'ACCEPTED' | 'REJECTED',
  ) => {
    setActionPending(true);
    try {
      const note = documentNotes[documentId]?.trim();
      const response = await platformClient.patch(
        `/platform/tenants/${encodeURIComponent(tenantId)}/kyb-documents/${encodeURIComponent(documentId)}/review`,
        { status: reviewStatus, ...(note ? { note } : {}) },
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Could not review document.');
      }
      toast.success(`Document ${reviewStatus.toLowerCase()}.`);
      setDocumentNotes((current) => ({ ...current, [documentId]: '' }));
      await queryClient.invalidateQueries({ queryKey: ['platform-review-tenants'] });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not review document.');
    } finally {
      setActionPending(false);
    }
  };

  const downloadDocument = async (tenantId: string, kybDocument: TenantDocument) => {
    try {
      const blob = await platformClient.getBlob(
        `/platform/tenants/${encodeURIComponent(tenantId)}/kyb-documents/${encodeURIComponent(kybDocument.id)}/content`,
      );
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = kybDocument.originalFilename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Could not download document.');
    }
  };

  if (platformSessionRestoring) {
    return <LoadingState message="Restoring platform session..." />;
  }

  if (!admin) {
    if (installationStatus === 'loading') {
      return <LoadingState message="Checking platform setup..." />;
    }

    return (
      <main className="platform-page">
        <header className="public-header">
          <a href="/" className="brand-wordmark">SaaS <span>POS</span></a>
          <a href="/" className="text-body-sm text-muted">Return to home</a>
        </header>
        <section className="platform-login surface-section">
          {installationStatus === 'error' ? (
            <>
              <p className="text-overline text-warning">Setup status unavailable</p>
              <h1 className="text-heading-h2">Platform administration</h1>
              <p role="alert" className="alert alert-danger">{installationStatusError}</p>
              <Button type="button" variant="outline" onClick={() => void checkInstallationStatus()}>
                Retry status check
              </Button>
            </>
          ) : installationStatus === 'uninitialized' ? (
            <>
              <p className="text-overline text-brand">First-time setup</p>
              <h1 className="text-heading-h2">Initialize platform</h1>
              <p className="text-body-sm text-muted">
                Create the first platform administrator. Choose and save these credentials; they are not generated or recoverable by the application.
              </p>
              {installationError && <p role="alert" className="alert alert-danger">{installationError}</p>}
              <form onSubmit={submitInstallation} className="form-stack">
                <Input
                  label="Platform name"
                  value={installationForm.platformName}
                  onChange={(event) => setInstallationForm((current) => ({ ...current, platformName: event.target.value }))}
                  minLength={1}
                  maxLength={120}
                  autoComplete="organization"
                  required
                />
                <Input
                  label="Administrator name"
                  value={installationForm.adminName}
                  onChange={(event) => setInstallationForm((current) => ({ ...current, adminName: event.target.value }))}
                  minLength={1}
                  maxLength={120}
                  autoComplete="name"
                  required
                />
                <Input
                  label="Administrator email"
                  type="email"
                  value={installationForm.adminEmail}
                  onChange={(event) => setInstallationForm((current) => ({ ...current, adminEmail: event.target.value }))}
                  autoComplete="email"
                  required
                />
                <Input
                  label="Administrator password"
                  type="password"
                  value={installationForm.password}
                  onChange={(event) => setInstallationForm((current) => ({ ...current, password: event.target.value }))}
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
                <Input
                  label="Installation secret"
                  type="password"
                  value={installationForm.installationSecret}
                  onChange={(event) => setInstallationForm((current) => ({ ...current, installationSecret: event.target.value }))}
                  autoComplete="off"
                  required
                  hint="Use the INSTALLATION_SECRET configured for this API deployment. It is sent only to initialize the platform."
                />
                <Button type="submit" isLoading={installationPending} className="w-full">
                  Initialize platform
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-overline text-brand">Restricted access</p>
              <h1 className="text-heading-h2">Platform administration</h1>
              <p className="text-body-sm text-muted">Sign in with an active platform administrator account.</p>
              {installationComplete && (
                <p role="status" className="alert alert-success">
                  Platform initialized. Sign in with the administrator email and password you just created.
                </p>
              )}
              {loginError && <p role="alert" className="alert alert-danger">{loginError}</p>}
              {mfaSetupToken ? (
                <div className="form-stack">
                  <h2 className="text-heading-h4">Set up required multi-factor authentication</h2>
                  <p className="text-body-sm text-muted">
                    Add this account to an authenticator app, then enter its current six-digit code.
                  </p>
                  {!mfaSecret ? (
                    <Button
                      type="button"
                      isLoading={mfaSetupPending}
                      onClick={() => void beginMfaSetup(mfaSetupToken)}
                    >
                      Generate authenticator setup key
                    </Button>
                  ) : (
                    <>
                      <p className="text-label-md text-secondary">Manual setup key</p>
                      <code className="break-all select-all">{mfaSecret}</code>
                      {mfaProvisioningUri && (
                        <a className="text-brand text-body-sm underline" href={mfaProvisioningUri}>
                          Open in an authenticator app
                        </a>
                      )}
                      <form onSubmit={submitMfaConfirmation} className="form-stack">
                        <Input
                          label="Authenticator code"
                          value={mfaCode}
                          onChange={(event) => setMfaCode(event.target.value)}
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          maxLength={6}
                          minLength={6}
                          required
                        />
                        <Button type="submit" isLoading={mfaSetupPending} className="w-full">
                          Verify and finish setup
                        </Button>
                      </form>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMfaSetupToken(null);
                      setMfaSecret(null);
                      setMfaProvisioningUri(null);
                      setMfaCode('');
                      setLoginError('');
                    }}
                  >
                    Start over
                  </Button>
                </div>
              ) : (
                <form onSubmit={submitLogin} className="form-stack">
                  <Input
                    label="Administrator email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  {mfaChallengeRequired && (
                    <Input
                      label="Authenticator or recovery code"
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value)}
                      autoComplete="one-time-code"
                      maxLength={64}
                      required
                    />
                  )}
                  <Button type="submit" isLoading={loginPending} className="w-full">
                    Sign in to platform
                  </Button>
                </form>
              )}
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="platform-page">
      <header className="platform-header">
        <div>
          <p className="text-overline text-brand">Platform administration</p>
          <h1 className="text-heading-h2">{showManagement ? 'Platform management' : 'Tenant review queue'}</h1>
        </div>
        <div className="platform-admin-actions">
          <Button type="button" variant={showManagement ? 'outline' : 'primary'} size="sm" onClick={() => setShowManagement(false)}>
            Review queue
          </Button>
          <Button type="button" variant={showManagement ? 'primary' : 'outline'} size="sm" onClick={() => setShowManagement(true)}>
            Management
          </Button>
          <span className="text-body-sm text-muted">{admin.name} · {admin.email}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </header>

      {recoveryCodes && (
        <section className="surface-section" role="status">
          <h2 className="text-heading-h4">Save your recovery codes now</h2>
          <p className="text-body-sm text-muted">
            Each code can be used once if you lose access to your authenticator. They will not be shown again.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {recoveryCodes.map((code) => <li key={code}><code className="select-all">{code}</code></li>)}
          </ul>
          <Button type="button" variant="outline" className="mt-4" onClick={() => setRecoveryCodes(null)}>
            I have saved these codes
          </Button>
        </section>
      )}

      {showManagement ? (
        <PlatformOperationsPanel client={platformClient} />
      ) : (
      <>
      <section className="surface-section">
        <form
          className="review-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchText.trim());
          }}
        >
          <Input
            label="Search applications"
            placeholder="Business, slug, or owner email"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <label className="form-field">
            <span className="text-label-md text-muted">Application status</span>
            <select
              className="input"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TenantStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </section>

      {query.isLoading ? (
        <LoadingState message="Loading tenant applications..." />
      ) : query.isError ? (
        <ErrorState
          title="Could not load applications"
          description={query.error instanceof Error ? query.error.message : 'Try again in a moment.'}
          action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>Retry</Button>}
        />
      ) : !query.data?.items.length ? (
        <EmptyState title="No applications found" description="Change the status filter or search terms." />
      ) : (
        <section className="review-list" aria-label="Tenant applications">
          {query.data.items.map((tenant) => {
            const canApprove =
              tenant.status === 'PENDING_REVIEW' &&
              tenant.kybDocuments.some((document) => document.reviewStatus === 'ACCEPTED') &&
              ['ACTIVE', 'TRIALING'].includes(tenant.subscription?.status ?? '');
            const owner = tenant.memberships[0]?.user;
            return (
              <article className="review-tenant" key={tenant.id}>
                <div className="review-tenant-heading">
                  <div>
                    <p className="text-overline text-brand">{tenant.businessType.replaceAll('_', ' ')}</p>
                    <h2 className="text-heading-h3">{tenant.name}</h2>
                    <p className="text-body-sm text-muted">
                      {tenant.slug} · {owner?.name ?? 'Owner not listed'} · {owner?.email ?? 'No owner email'}
                    </p>
                  </div>
                  <span className={`status-label ${tenant.status === 'ACTIVE' ? 'status-success' : tenant.status === 'PENDING_REVIEW' ? 'status-warning' : 'status-danger'}`}>
                    {tenant.status.replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="review-meta">
                  <span>Submitted {new Date(tenant.createdAt).toLocaleDateString()}</span>
                  <span aria-hidden="true">·</span>
                  <span>{tenant.subscription?.planVersion?.plan.name ?? 'No plan'} · {tenant.subscription?.status ?? 'No subscription'}</span>
                </div>

                <div className="review-documents">
                  <h3 className="text-title-md">Business documents</h3>
                  {!tenant.kybDocuments.length ? (
                    <p className="text-body-sm text-muted">No KYB documents submitted.</p>
                  ) : tenant.kybDocuments.map((document) => (
                    <div className="review-document" key={document.id}>
                      <div className="review-document-heading">
                        <div>
                          <p className="text-body-md">{document.documentName}</p>
                          <p className="text-caption text-muted">
                            {document.originalFilename} · {(document.sizeBytes / 1024).toFixed(0)} KB · {document.reviewStatus}
                          </p>
                          {document.reviewNote && <p className="text-body-sm text-muted">{document.reviewNote}</p>}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => void downloadDocument(tenant.id, document)}>
                          Download
                        </Button>
                      </div>
                      {tenant.status === 'PENDING_REVIEW' && document.reviewStatus === 'PENDING' && (
                        <div className="document-actions">
                          <Input
                            label="Review note"
                            value={documentNotes[document.id] ?? ''}
                            onChange={(event) => setDocumentNotes((current) => ({
                              ...current,
                              [document.id]: event.target.value,
                            }))}
                            maxLength={1000}
                            hint="Required when rejecting a document."
                          />
                          <Button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void reviewDocument(tenant.id, document.id, 'ACCEPTED')}
                          >
                            Accept document
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            disabled={actionPending || !documentNotes[document.id]?.trim()}
                            onClick={() => void reviewDocument(tenant.id, document.id, 'REJECTED')}
                          >
                            Reject document
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {tenant.reviewEvents.length > 0 && (
                  <div className="review-history">
                    <h3 className="text-title-md">Review history</h3>
                    {tenant.reviewEvents.map((event) => (
                      <p className="text-body-sm text-muted" key={`${event.action}-${event.createdAt}`}>
                        {event.action === 'platform.tenant.approved' ? 'Approved' : 'Rejected'} · {new Date(event.createdAt).toLocaleString()}
                        {typeof event.metadata?.reason === 'string' ? ` · ${event.metadata.reason}` : ''}
                      </p>
                    ))}
                  </div>
                )}

                {tenant.status === 'PENDING_REVIEW' && (
                  <div className="tenant-decision">
                    <Button
                      type="button"
                      disabled={actionPending || !canApprove}
                      onClick={() => void postAction(tenant.id, 'approve')}
                    >
                      Approve tenant
                    </Button>
                    {!canApprove && (
                      <p className="text-caption text-muted">
                        Approval requires an accepted KYB document and an active subscription or trial.
                      </p>
                    )}
                    <form
                      className="tenant-rejection-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void postAction(tenant.id, 'reject', { reason: rejectionReasons[tenant.id]?.trim() });
                      }}
                    >
                      <Input
                        label="Rejection reason"
                        value={rejectionReasons[tenant.id] ?? ''}
                        onChange={(event) => setRejectionReasons((current) => ({
                          ...current,
                          [tenant.id]: event.target.value,
                        }))}
                        maxLength={1000}
                        required
                      />
                      <Button type="submit" variant="danger" disabled={actionPending}>
                        Reject application
                      </Button>
                    </form>
                  </div>
                )}
                {tenant.status === 'ACTIVE' && (
                  <div className="tenant-decision">
                    <Button
                      type="button"
                      variant="danger"
                      disabled={actionPending}
                      onClick={() => void updateTenantStatus(tenant.id, 'SUSPENDED')}
                    >
                      Suspend tenant
                    </Button>
                  </div>
                )}
                {tenant.status === 'SUSPENDED' && (
                  <div className="tenant-decision">
                    <Button
                      type="button"
                      disabled={actionPending}
                      onClick={() => void updateTenantStatus(tenant.id, 'ACTIVE')}
                    >
                      Reactivate tenant
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      <footer className="review-pagination">
        <span className="text-body-sm text-muted">{visibleRange}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </Button>
          <span className="text-body-sm text-muted">Page {page} of {pageCount}</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>
            Next
          </Button>
        </div>
      </footer>
      </>
      )}
    </main>
  );
}
