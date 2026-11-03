import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface RegistrationForm {
  tenantName: string;
  tenantSlug: string;
  businessType: 'RETAIL' | 'PHARMACY' | 'HYBRID';
  ownerName: string;
  ownerEmail: string;
  password: string;
  planCode: 'STARTER' | 'GROWTH' | 'BUSINESS';
}

export function RegisterPage() {
  const [form, setForm] = useState<RegistrationForm>({
    tenantName: '',
    tenantSlug: '',
    businessType: 'RETAIL',
    ownerName: '',
    ownerEmail: '',
    password: '',
    planCode: 'STARTER',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [verificationDeliveryFailed, setVerificationDeliveryFailed] = useState(false);

  const handleChange = <K extends keyof RegistrationForm>(field: K, value: RegistrationForm[K]) => {
    const normalizedValue = field === 'tenantSlug' && typeof value === 'string'
      ? value.toLowerCase()
      : value;
    setForm((prev) => ({ ...prev, [field]: normalizedValue }));
    setError('');
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      const response = await apiClient.post<{ status: 'PENDING_REVIEW'; message: string }>(
        '/auth/register',
        form,
      );

      if (response.success && response.data) {
        setSubmitted(true);
      } else {
        if ((response.error?.status ?? 0) >= 500) {
          setVerificationDeliveryFailed(true);
          setSubmitted(true);
          return;
        }
        const details = response.error?.details ?? [];
        const next: Record<string, string> = {};
        details.forEach((detail) => {
          if (detail.field && detail.message) next[detail.field] = detail.message;
        });
        if (Object.keys(next).length > 0) {
          setFieldErrors(next);
          setError('Please correct the highlighted fields and submit again.');
        } else {
          setError(response.error?.message || 'Registration failed');
        }
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Registration request failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="p-6 max-w-md mx-auto mt-6">
        <div className="text-center">
          <h1 className="text-heading-h2 text-primary">Registration submitted</h1>
          {verificationDeliveryFailed ? (
            <p className="text-body-sm text-muted mt-4">
              Your application was created, but we could not deliver the verification email. Once email delivery is available, use the sign-in page to request a new verification link before signing in.
            </p>
          ) : (
            <p className="text-body-sm text-muted mt-4">
              Your tenant is pending platform review. Verify your email address before signing in with your tenant slug and owner credentials to upload the required documents and check your application status.
            </p>
          )}
          <Link to="/login" className="inline-block mt-6 text-brand text-sm font-medium hover:underline">
            Go to sign in
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 max-w-md mx-auto mt-6">
      <div className="text-center mb-8">
        <h1 className="text-heading-h2 text-primary">Register Tenant</h1>
        <p className="text-body-sm text-muted">Create your SaaS POS account</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-danger text-inverse text-sm rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Tenant Name"
          placeholder="e.g. Acme Retail"
          value={form.tenantName}
          onChange={(e) => handleChange('tenantName', e.target.value)}
          minLength={2}
          maxLength={120}
          autoComplete="organization"
          required
          error={fieldErrors.tenantName}
        />
        <Input
          label="Tenant Slug"
          placeholder="e.g. acme-retail"
          value={form.tenantSlug}
          onChange={(e) => handleChange('tenantSlug', e.target.value)}
          minLength={2}
          maxLength={60}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          autoCapitalize="none"
          required
          error={fieldErrors.tenantSlug}
        />
        <p className="text-caption text-muted">
          Lowercase letters, numbers, and single hyphens only (2–60 characters, e.g. acme-retail).
        </p>
        <div className="form-field">
          <label className="block text-label-md text-secondary mb-1">Business Type</label>
          <select
            className="input"
            value={form.businessType}
            onChange={(e) => handleChange('businessType', e.target.value as RegistrationForm['businessType'])}
            required
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
          minLength={2}
          maxLength={120}
          autoComplete="name"
          required
          error={fieldErrors.ownerName}
        />
        <Input
          label="Owner Email"
          type="email"
          placeholder="jane@acme.com"
          value={form.ownerEmail}
          onChange={(e) => handleChange('ownerEmail', e.target.value)}
          autoComplete="email"
          required
          error={fieldErrors.ownerEmail}
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => handleChange('password', e.target.value)}
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          error={fieldErrors.password}
        />
        <p className="text-caption text-muted">
          Use 12–128 characters.
        </p>
        <div className="form-field">
          <label className="block text-label-md text-secondary mb-1">Subscription Plan</label>
          <select
            className="input"
            value={form.planCode}
            onChange={(e) => handleChange('planCode', e.target.value as RegistrationForm['planCode'])}
            required
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
