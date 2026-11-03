import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const publicPlatformClient = new ApiClient();

export function PlatformInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This invitation link is missing its one-time token.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setPending(true);
    try {
      const response = await publicPlatformClient.post<{ accepted: true }>(
        '/platform/auth/invitation/accept',
        { token, password },
      );
      if (!response.success || !response.data?.accepted) {
        throw new Error(response.error?.message || 'Could not accept this invitation.');
      }
      setAccepted(true);
      setPassword('');
      setConfirmation('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not accept this invitation.');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="platform-page">
      <header className="public-header">
        <a href="/" className="brand-wordmark">SaaS <span>POS</span></a>
        <Link to="/platform/review" className="text-body-sm text-muted">Platform sign in</Link>
      </header>
      <section className="platform-login surface-section">
        <p className="text-overline text-brand">Platform administration</p>
        <h1 className="text-heading-h2">Accept administrator invitation</h1>
        {accepted ? (
          <div className="form-stack">
            <p className="alert alert-success" role="status">
              Invitation accepted. Sign in to enroll in required multi-factor authentication.
            </p>
            <Link to="/platform/review" className="text-brand underline">Continue to platform sign in</Link>
          </div>
        ) : (
          <>
            <p className="text-body-sm text-muted">Choose a strong password. Multi-factor authentication is required on first sign-in.</p>
            {error && <p role="alert" className="alert alert-danger">{error}</p>}
            <form onSubmit={submit} className="form-stack">
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <Input
                label="Confirm password"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <Button type="submit" isLoading={pending} className="w-full">Accept invitation</Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
