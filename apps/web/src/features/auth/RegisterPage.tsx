import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/auth/AuthProvider';
import { apiClient } from '../../lib/api-client';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface RegisterProps {
  onRegister?: (token: string, user: any) => void;
}

export function RegisterPage({ onRegister }: RegisterProps) {
  const [form, setForm] = useState({
    tenantName: '',
    tenantSlug: '',
    businessType: 'RETAIL',
    ownerName: '',
    ownerEmail: '',
    password: '',
    planCode: 'STARTER',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post<{ accessToken: string; user: any }>(
        '/auth/register',
        form,
      );

      if (response.success && response.data) {
        const { accessToken, user } = response.data;
        apiClient.setToken(accessToken);
        login(accessToken, user);
        onRegister?.(accessToken, user);
        navigate('/app/dashboard', { replace: true });
      } else {
        setError(response.error?.message || 'Registration failed');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Registration request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto mt-6">
      <div className="text-center mb-8">
        <h1 className="text-heading-h2 text-primary">Register Tenant</h1>
        <p className="text-body-sm text-muted">Create your SaaS POS account</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger text-inverse text-sm rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Tenant Name"
          placeholder="e.g. Acme Retail"
          value={form.tenantName}
          onChange={(e) => handleChange('tenantName', e.target.value)}
          required
        />
        <Input
          label="Tenant Slug"
          placeholder="e.g. acme-retail"
          value={form.tenantSlug}
          onChange={(e) => handleChange('tenantSlug', e.target.value)}
          required
        />
        <div className="form-field">
          <label className="block text-label-md text-secondary mb-1">Business Type</label>
          <select
            className="input"
            value={form.businessType}
            onChange={(e) => handleChange('businessType', e.target.value)}
          >
            <option value="RETAIL">Retail</option>
            <option value="PHARMACY">Pharmacy</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
        <Input
          label="Owner Name"
          placeholder="e.g. Jane Smith"
          value={form.ownerName}
          onChange={(e) => handleChange('ownerName', e.target.value)}
          required
        />
        <Input
          label="Owner Email"
          type="email"
          placeholder="jane@acme.com"
          value={form.ownerEmail}
          onChange={(e) => handleChange('ownerEmail', e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => handleChange('password', e.target.value)}
          required
        />
        <div className="form-field">
          <label className="block text-label-md text-secondary mb-1">Subscription Plan</label>
          <select
            className="input"
            value={form.planCode}
            onChange={(e) => handleChange('planCode', e.target.value)}
          >
            <option value="STARTER">Starter</option>
            <option value="GROWTH">Growth</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={loading}
          className="w-full"
        >
          Register
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-brand text-sm font-medium hover:underline">
          Already have an account? Sign in
        </Link>
      </div>
    </Card>
  );
}
