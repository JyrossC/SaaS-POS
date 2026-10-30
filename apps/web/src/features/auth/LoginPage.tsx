import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/auth/AuthProvider';
import { apiClient } from '../../lib/api-client';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface LoginProps {
  onLogin?: (token: string, user: any) => void;
}

export function LoginPage({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post<{ accessToken: string; user: any }>(
        '/auth/login',
        { email, password, tenantSlug },
      );

      if (response.success && response.data) {
        const { accessToken, user } = response.data;
        apiClient.setToken(accessToken);
        login(accessToken, user);
        onLogin?.(accessToken, user);
        navigate('/app/dashboard', { replace: true });
      } else {
        setError(response.error?.message || 'Login failed');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login request failed');
    } finally {
      setLoading(false);
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

      <div className="mt-6 text-center">
        <Link to="/register" className="text-brand text-sm font-medium hover:underline">
          Don't have an account? Register
        </Link>
      </div>
    </Card>
  );
}
