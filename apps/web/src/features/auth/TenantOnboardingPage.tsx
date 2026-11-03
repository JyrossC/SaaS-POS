import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../lib/api-client';

interface KybDocument {
  id: string;
  documentName: string;
  originalFilename: string;
  reviewStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: string;
}

interface ApplicantStatus {
  name: string;
  slug: string;
  status: 'PENDING_REVIEW' | 'REJECTED';
  submittedAt: string;
  subscriptionStatus: string | null;
  rejectionReason: string | null;
  kybDocuments: KybDocument[];
}

export function TenantOnboardingPage({ onLogout }: { onLogout: () => void }) {
  const [application, setApplication] = useState<ApplicantStatus | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshStatus = useCallback(async () => {
    const response = await apiClient.get<ApplicantStatus>('/tenant/onboarding/status');
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Could not load application status.');
    }
    setApplication(response.data);
  }, []);

  useEffect(() => {
    let active = true;
    void apiClient.get<ApplicantStatus>('/tenant/onboarding/status')
      .then((response) => {
        if (!active) return;
        if (response.success && response.data) {
          setApplication(response.data);
        } else {
          setError(response.error?.message || 'Could not load application status.');
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load application status.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const submitDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!documentFile) {
      setError('Choose a document to upload.');
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');
    const formData = new FormData();
    formData.set('documentName', documentName);
    formData.set('document', documentFile);

    try {
      const response = await apiClient.post('/tenant/onboarding/kyb-documents', formData);
      if (!response.success) {
        setError(response.error?.message || 'Document upload failed.');
        return;
      }
      setDocumentName('');
      setDocumentFile(null);
      setNotice('Document uploaded for platform review.');
      await refreshStatus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Document upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <p className="p-8 text-center text-muted">Loading application status...</p>;
  }

  return (
    <main className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-caption text-muted">Tenant application</p>
              <h1 className="text-heading-h2 text-primary mt-1">Application review</h1>
              {application && (
                <p className="text-body-sm text-muted mt-2">
                  {application.name} ({application.slug})
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onLogout}>Sign out</Button>
          </div>

          {error && <p role="alert" className="mt-4 rounded-md bg-danger p-3 text-inverse">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-md bg-success p-3 text-inverse">{notice}</p>}

          {application && (
            <div className="mt-6 space-y-3">
              <p className="text-body-md text-primary">
                Status: <strong>{application.status === 'PENDING_REVIEW' ? 'Pending review' : 'Not approved'}</strong>
              </p>
              {application.subscriptionStatus && (
                <p className="text-body-sm text-muted">
                  Plan status: {application.subscriptionStatus.replaceAll('_', ' ').toLowerCase()}
                </p>
              )}
              {application.status === 'PENDING_REVIEW' && (
                <p className="text-body-sm text-secondary">
                  Upload your business documents below. Your account is limited to this application until the platform review is complete.
                </p>
              )}
              {application.rejectionReason && (
                <p className="rounded-md bg-subtle p-3 text-body-sm text-primary">
                  Review decision: {application.rejectionReason}
                </p>
              )}
            </div>
          )}
        </Card>

        {application?.status === 'PENDING_REVIEW' && (
          <Card className="p-6">
            <h2 className="text-heading-h4 text-primary">Submit KYB documents</h2>
            <p className="text-body-sm text-muted mt-1">
              Supported files: PDF, PNG, JPG, or DOCX, up to 10 MB each.
            </p>
            <form onSubmit={submitDocument} className="mt-5 space-y-4">
              <Input
                label="Document name"
                value={documentName}
                onChange={(event) => setDocumentName(event.target.value)}
                maxLength={120}
                required
              />
              <label className="block text-label-md text-secondary">
                Document file
                <input
                  className="mt-2 block w-full text-sm"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                  required
                />
              </label>
              <Button type="submit" variant="primary" size="md" isLoading={uploading}>
                Upload document
              </Button>
            </form>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-heading-h4 text-primary">Submitted documents</h2>
          {!application?.kybDocuments.length ? (
            <p className="mt-3 text-body-sm text-muted">No documents have been submitted.</p>
          ) : (
            <ul className="mt-3 divide-y divide-default">
              {application.kybDocuments.map((document) => (
                <li key={document.id} className="py-3">
                  <p className="text-body-md text-primary">{document.documentName}</p>
                  <p className="text-caption text-muted">
                    {document.originalFilename} · {document.reviewStatus.toLowerCase()}
                  </p>
                  {document.reviewNote && (
                    <p className="mt-1 text-body-sm text-secondary">{document.reviewNote}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
