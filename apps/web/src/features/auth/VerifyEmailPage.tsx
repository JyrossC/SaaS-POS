import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

type VerificationResult = { verified: true };

const verificationRequests = new Map<string, Promise<ApiResponse<VerificationResult>>>();

function verifyEmailOnce(token: string) {
  let request = verificationRequests.get(token);
  if (!request) {
    request = apiClient.post<VerificationResult>('/auth/email/verify', { token });
    verificationRequests.set(token, request);
    const currentRequest = request;
    void request.then(
      () => {
        if (verificationRequests.get(token) === currentRequest) verificationRequests.delete(token);
      },
      () => {
        if (verificationRequests.get(token) === currentRequest) verificationRequests.delete(token);
      },
    );
  }
  return request;
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [status, setStatus] = useState<'pending' | 'verified' | 'error'>(token ? 'pending' : 'error');
  const [error, setError] = useState(token ? '' : 'This email verification link is missing its token.');

  useEffect(() => {
    if (!token) return;
    let active = true;
    window.history.replaceState({}, '', window.location.pathname);
    void verifyEmailOnce(token)
      .then((response) => {
        if (!active) return;
        if (!response.success) {
          setError(response.error?.message || 'This email verification link is invalid or has expired.');
          setStatus('error');
          return;
        }
        setStatus('verified');
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : 'Email verification failed.');
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <Card className="p-6 max-w-md mx-auto mt-10 text-center">
      {status === 'pending' ? (
        <>
          <h1 className="text-heading-h2 text-primary">Verifying email</h1>
          <p role="status" className="mt-3 text-body-sm text-muted">Please wait while we verify your email address.</p>
        </>
      ) : status === 'verified' ? (
        <>
          <h1 className="text-heading-h2 text-primary">Email verified</h1>
          <p className="mt-3 text-body-sm text-muted">Your email is verified. You can now sign in.</p>
          <Link to="/login" className="inline-block mt-6">
            <Button>Continue to sign in</Button>
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-heading-h2 text-primary">Verification link unavailable</h1>
          <p role="alert" className="mt-3 text-body-sm text-danger">{error}</p>
          <p className="mt-3 text-body-sm text-muted">
            Request a new verification email from the sign-in page.
          </p>
          <Link to="/login" className="inline-block mt-6">
            <Button variant="outline">Return to sign in</Button>
          </Link>
        </>
      )}
    </Card>
  );
}
