import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../lib/api-client';

export function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('token')) {
      url.searchParams.delete('token');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('This reset link is invalid or has expired. Request a new link.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/auth/password/reset', { token, password });
      if (!response.success) {
        setError(response.error?.message || 'Password reset failed.');
        return;
      }
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto mt-10">
      <div className="text-center mb-8">
        <h1 className="text-heading-h2 text-primary">Choose a new password</h1>
        <p className="text-body-sm text-muted mt-2">Use at least 12 characters.</p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-md bg-danger p-3 text-inverse">{error}</p>}
      {complete ? (
        <div className="text-center">
          <p role="status" className="text-body-md text-primary">Your password has been reset.</p>
          <Link to="/login" className="inline-block mt-6 text-brand text-sm font-medium hover:underline">
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="New password"
            type="password"
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            minLength={12}
            maxLength={128}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
          <Button type="submit" variant="primary" size="md" isLoading={loading} className="w-full">
            Reset password
          </Button>
        </form>
      )}
    </Card>
  );
}
