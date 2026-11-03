import { Link } from 'react-router-dom';

const AVAILABLE_WORKFLOWS = [
  {
    title: 'Tenant onboarding',
    description: 'Submit a business application and follow its platform review status.',
  },
  {
    title: 'Catalogue and store management',
    description: 'Set up stores and products for your approved business.',
  },
  {
    title: 'Sales and stock operations',
    description: 'Use available sales, purchasing, inventory, and cash-session workflows.',
  },
];

export function LandingPage() {
  return (
    <div className="public-page">
      <header className="public-header">
        <Link to="/" className="brand-wordmark" aria-label="SaaS POS home">
          SaaS <span>POS</span>
        </Link>
        <nav className="public-nav" aria-label="Main navigation">
          <Link to="/login">Sign in</Link>
          <Link to="/register">Apply for an account</Link>
          <Link to="/platform/review">Platform administration</Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <p className="text-overline text-brand">Retail operations platform</p>
          <h1 className="text-display-lg">
            The Commerce Platform
            <span>Built for Retail &amp; Pharmacy</span>
          </h1>
          <p className="landing-lede">
            Manage business onboarding and core store operations in one place. Tenant
            applications remain restricted until reviewed and approved by the platform.
          </p>
          <div className="landing-actions">
            <Link to="/register" className="btn btn-primary btn-lg">
              Apply for a business account
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg">
              Sign in
            </Link>
          </div>
        </section>

        <section className="landing-workflows" aria-labelledby="workflow-heading">
          <div className="section-heading">
            <p className="text-overline text-brand">Current application workflows</p>
            <h2 id="workflow-heading" className="text-heading-h2">A clear path from application to operations</h2>
          </div>
          <div className="workflow-grid">
            {AVAILABLE_WORKFLOWS.map((workflow, index) => (
              <article className="workflow-item" key={workflow.title}>
                <span className="workflow-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-title-md">{workflow.title}</h3>
                  <p className="text-body-sm text-muted">{workflow.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-review-note">
          <div>
            <p className="text-overline text-warning">Platform review required</p>
            <h2 className="text-heading-h3">New accounts are not activated at registration.</h2>
            <p className="text-body-sm text-secondary">
              After applying, sign in to upload KYB documents and view the review status.
              Operational tenant access is enabled after platform approval.
            </p>
          </div>
          <Link to="/register" className="text-brand landing-inline-link">Start an application <span aria-hidden="true">→</span></Link>
        </section>
      </main>

      <footer className="public-footer">
        <span className="text-body-sm text-muted">SaaS POS</span>
        <Link to="/platform/review" className="text-body-sm text-muted">Platform administration</Link>
      </footer>
    </div>
  );
}
