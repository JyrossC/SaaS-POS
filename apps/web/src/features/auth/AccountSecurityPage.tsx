import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../components/auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../lib/api-client';

interface MfaSetup {
  secret: string;
  provisioningUri: string;
}

export function AccountSecurityPage() {
  const { user } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(Boolean(user?.mfaEnabled));
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setMfaEnabled(Boolean(user?.mfaEnabled));
  }, [user?.id, user?.mfaEnabled]);

  const beginSetup = async () => {
    setPending(true);
    setError('');
    setNotice('');
    try {
      const response = await apiClient.post<MfaSetup>('/auth/mfa/setup');
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not start MFA setup.');
      }
      setSetup(response.data);
      setCode('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start MFA setup.');
    } finally {
      setPending(false);
    }
  };

  const confirmSetup = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    setNotice('');
    try {
      const response = await apiClient.post<{ recoveryCodes: string[] }>('/auth/mfa/confirm', {
        code: code.trim(),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Could not confirm MFA setup.');
      }
      setMfaEnabled(true);
      setSetup(null);
      setCode('');
      setRecoveryCodes(response.data.recoveryCodes);
      setNotice('Multi-factor authentication is enabled.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not confirm MFA setup.');
    } finally {
      setPending(false);
    }
  };

  const disableMfa = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    setNotice('');
    try {
      const response = await apiClient.post<{ disabled: true }>('/auth/mfa/disable', {
        code: code.trim(),
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Could not disable MFA.');
      }
      setMfaEnabled(false);
      setCode('');
      setRecoveryCodes(null);
      setNotice('Multi-factor authentication is disabled.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not disable MFA.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-overline text-brand">Account</p>
        <h1 className="text-heading-h2">Security</h1>
        <p className="text-body-sm text-muted mt-2">
          Manage authenticator-based multi-factor authentication for {user?.email}.
        </p>
      </header>

      <Card className="p-6 max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-heading-h4">Multi-factor authentication</h2>
            <p className="text-body-sm text-muted mt-2">
              {mfaEnabled
                ? 'MFA is enabled. You will need an authenticator or a one-time recovery code when you sign in.'
                : 'MFA is optional for tenant accounts. Add an authenticator app for an additional sign-in check.'}
            </p>
          </div>
          <span className={mfaEnabled ? 'badge badge-success' : 'badge'}>
            {mfaEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {error && <p role="alert" className="alert alert-danger mt-4">{error}</p>}
        {notice && <p role="status" className="alert alert-success mt-4">{notice}</p>}

        {!mfaEnabled && !setup && (
          <Button type="button" className="mt-5" isLoading={pending} onClick={() => void beginSetup()}>
            Set up MFA
          </Button>
        )}

        {setup && (
          <div className="mt-5 space-y-4">
            <p className="text-body-sm text-secondary">
              Add this account to an authenticator app using the setup key, then enter its current six-digit code.
            </p>
            <div className="form-field">
              <span className="text-label-md text-secondary">Manual setup key</span>
              <code className="break-all select-all">{setup.secret}</code>
            </div>
            <a className="text-brand text-body-sm underline" href={setup.provisioningUri}>
              Open in an authenticator app
            </a>
            <form onSubmit={confirmSetup} className="space-y-4">
              <Input
                label="Authenticator code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                minLength={6}
                maxLength={6}
                required
              />
              <Button type="submit" isLoading={pending}>Verify and enable MFA</Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setSetup(null);
                  setCode('');
                }}
              >
                Cancel setup
              </Button>
            </form>
          </div>
        )}

        {mfaEnabled && (
          <form onSubmit={disableMfa} className="mt-5 space-y-4">
            <Input
              label="Authenticator or recovery code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              maxLength={64}
              required
              hint="Confirm your identity to disable MFA."
            />
            <Button type="submit" variant="outline" isLoading={pending}>
              Disable MFA
            </Button>
          </form>
        )}

        {recoveryCodes && (
          <section className="mt-6 border-t border-default pt-5" role="status">
            <h3 className="text-heading-h4">Save your recovery codes now</h3>
            <p className="text-body-sm text-muted mt-2">
              Each code works once if you lose access to your authenticator. These codes will not be shown again.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {recoveryCodes.map((recoveryCode) => (
                <li key={recoveryCode}><code className="select-all">{recoveryCode}</code></li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setRecoveryCodes(null)}
            >
              I have saved these codes
            </Button>
          </section>
        )}
      </Card>
    </div>
  );
}
