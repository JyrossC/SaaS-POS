import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../lib/api-client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await apiClient.post<{ message: string }>('/auth/password/forgot', { email });
      if (!response.success) {
        setError(response.error?.message || 'Password reset request failed.');
        return;
      }
      setMessage(
        response.data?.message ||
        'If an account exists for this address, password reset instructions will be sent.',
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Password reset request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto mt-10">
      <div className="text-center mb-8">
        <h1 className="text-heading-h2 text-primary">Reset your password</h1>
        <p className="text-body-sm text-muted mt-2">We will email a secure reset link if an account matches.</p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-md bg-danger p-3 text-inverse">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-md bg-subtle p-3 text-primary">{message}</p>}

      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Button type="submit" variant="primary" size="md" isLoading={loading} className="w-full">
          Send reset link
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-brand text-sm font-medium hover:underline">
          Return to sign in
        </Link>
      </div>
    </Card>
  );
}
