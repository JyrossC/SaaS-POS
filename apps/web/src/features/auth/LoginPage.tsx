import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/auth/AuthProvider';
import { apiClient } from '../../lib/api-client';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaChallengeRequired, setMfaChallengeRequired] = useState(false);
  const [error, setError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post<{ accessToken: string; user: any }>(
        '/auth/login',
        { email, password, tenantSlug, ...(mfaCode ? { mfaCode } : {}) },
      );

      if (response.success && response.data) {
        const { accessToken, user } = response.data;
        login(accessToken, user);
        navigate(
          user.tenantStatus === 'ACTIVE' ? '/app/dashboard' : '/app/onboarding',
          { replace: true },
        );
      } else {
        const message = response.error?.message || 'Login failed';
        setError(message);
        if (message.toLowerCase().includes('multi-factor code')) {
          setMfaChallengeRequired(true);
        }
        if (response.error?.status === 403) {
          setVerificationMessage('Verify your email address before signing in. You can request a new verification email below.');
        }
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login request failed');
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setResendingVerification(true);
    setVerificationMessage('');
    try {
      const response = await apiClient.post<{ message: string }>('/auth/email/verification/resend', {
        email: email.trim(),
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Could not request a verification email.');
      }
      setVerificationMessage(
        response.data?.message || 'If this account requires email verification, instructions will be sent.',
      );
    } catch (requestError) {
      setVerificationMessage(
        requestError instanceof Error ? requestError.message : 'Could not request a verification email.',
      );
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto mt-10">
      <div className="text-center mb-8">
        <h1 className="text-heading-h2 text-primary">Sign in</h1>
        <p className="text-body-sm text-muted">Welcome back to SaaS POS</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger text-inverse text-sm rounded-md">
          {error}
        </div>
      )}
      {verificationMessage && (
        <p role="status" className="mb-4 text-body-sm text-secondary">
          {verificationMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Tenant Slug"
          placeholder="e.g. acme-retail"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mfaChallengeRequired && (
          <Input
            label="Authenticator or recovery code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            autoComplete="one-time-code"
            maxLength={32}
            required
          />
        )}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={loading}
          className="w-full"
        >
          Sign in
        </Button>
      </form>
      {verificationMessage && (
        <Button
          type="button"
          variant="outline"
          isLoading={resendingVerification}
          className="w-full mt-3"
          onClick={() => void resendVerification()}
          disabled={!email.trim()}
        >
          Resend verification email
        </Button>
      )}

      <div className="mt-6 text-center">
        <Link to="/register" className="text-brand text-sm font-medium hover:underline">
          Don't have an account? Register
        </Link>
        <p className="mt-3">
          <Link to="/forgot-password" className="text-brand text-sm font-medium hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </Card>
  );
}
