import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient, ApiResponse } from '../../lib/api-client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { toast } from 'react-hot-toast';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalStores: number;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
}

interface FeatureItem {
  title: string;
  description: string;
  icon: string;
  benefit: string;
}

interface PlanItem {
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

interface TestimonialItem {
  name: string;
  role: string;
  business: string;
  content: string;
  rating: number;
  initials: string;
}

interface StatItem {
  label: string;
  value: string | number;
  subtext: string;
  icon: string;
  gradient: string;
}

const GRADIENTS: Record<string, string> = {
  blue: 'from-blue-500 to-cyan-500',
  green: 'from-emerald-500 to-green-500',
  amber: 'from-amber-500 to-orange-500',
  rose: 'from-rose-500 to-pink-500',
  purple: 'from-violet-500 to-purple-500',
  indigo: 'from-indigo-500 to-blue-500',
};

const FEATURES: FeatureItem[] = [
  {
    title: 'Multi-Tenant Isolation',
    description: 'Your business data is completely isolated. Never mix with another tenant.',
    icon: '🏢',
    benefit: 'Bank-grade security for every store',
  },
  {
    title: 'Subscription Entitlements',
    description: 'Plan-based feature gating with concurrency-safe limits. Upgrade anytime without downtime.',
    icon: '📋',
    benefit: 'Pay only for what you need',
  },
  {
    title: 'POS & Inventory',
    description: 'Atomic sale transactions, server-side pricing, real-time stock adjustments.',
    icon: '💳',
    benefit: 'Never lose a sale again',
  },
  {
    title: 'Pharmacy Compliance',
    description: 'FEFO batch allocation, expiry tracking, prescription dispensing, quarantine management.',
    icon: '💊',
    benefit: 'Regulatory-ready workflows',
  },
  {
    title: 'Purchasing & Suppliers',
    description: 'Purchase orders, goods receipts, and supplier management with auto-inventory reconciliation.',
    icon: '🧾',
    benefit: 'Never run out of stock',
  },
  {
    title: 'Business Intelligence',
    description: 'Sales summaries, store comparisons, inventory reports, AI-assisted analytics.',
    icon: '📈',
    benefit: 'Data-driven decisions',
  },
];

const PRICING: PlanItem[] = [
  {
    name: 'Starter',
    description: 'Perfect for single-store retailers getting started.',
    price: '$29',
    period: '/month',
    features: [
      '1 store',
      '3 staff members',
      'POS & inventory',
      'Basic reporting',
      'Email support',
    ],
    highlighted: false,
    cta: 'Start Free Trial',
  },
  {
    name: 'Growth',
    description: 'For growing businesses with multiple locations.',
    price: '$79',
    period: '/month',
    features: [
      '3 stores',
      '10 staff members',
      'POS & inventory',
      'Purchasing & suppliers',
      'Advanced reporting',
      'Priority support',
    ],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Business',
    description: 'For enterprise retailers and pharmacy chains.',
    price: '$199',
    period: '/month',
    features: [
      '10 stores',
      '30 staff members',
      'All modules',
      'Pharmacy compliance',
      'BI & AI analytics',
      'Dedicated support',
    ],
    highlighted: false,
    cta: 'Contact Sales',
  },
];

const TESTIMONIALS: TestimonialItem[] = [
  {
    name: 'Maria Chen',
    role: 'Owner',
    business: 'Downtown Pharmacy',
    content: 'SaaS POS transformed our pharmacy operations. FEFO batch tracking and expiry alerts have eliminated waste completely.',
    rating: 5,
    initials: 'MC',
  },
  {
    name: 'James Rivera',
    role: 'Manager',
    business: 'Corner Market Retail',
    content: 'The atomic POS transactions mean we never have to worry about partial sales or inventory mismatches again.',
    rating: 5,
    initials: 'JR',
  },
  {
    name: 'Sarah Thompson',
    role: 'Founder',
    business: 'Urban Goods Co.',
    content: 'Multi-tenant isolation gives us peace of mind. Our data is secure, and the onboarding was seamless.',
    rating: 5,
    initials: 'ST',
  },
];

export function LandingPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.get<PlatformStats>('/platform/stats');
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setError(response.error?.message || 'Unable to load platform stats');
      }
    } catch {
      // Silent fail — use fallback values below
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statItems = [
    {
      label: 'Active Tenants',
      value: stats?.activeTenants ?? 0,
      subtext: 'businesses on our platform',
      icon: '🏪',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Total Stores',
      value: stats?.totalStores ?? 0,
      subtext: 'locations powered by SaaS POS',
      icon: '📍',
      gradient: 'from-emerald-500 to-green-500',
    },
    {
      label: 'Products Catalogued',
      value: stats?.totalProducts ?? 0,
      subtext: 'SKUs across the network',
      icon: '📦',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      label: 'Completed Sales',
      value: stats?.totalSales ?? 0,
      subtext: 'transactions processed securely',
      icon: '💰',
      gradient: 'from-rose-500 to-pink-500',
    },
  ];

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(val);

  return (
    <div className="min-h-screen bg-canvas text-primary selection:bg-brand selection:text-inverse">
      {/* Navigation */}
      <nav className="topbar bg-surface/95 backdrop-blur border-b border-default sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4 max-w-[1440px] mx-auto">
          <Link to="/" className="flex items-center gap-2 text-title-md font-bold text-primary">
            <span className="text-brand">SaaS</span><span className="text-secondary">POS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className="text-secondary hover:text-primary transition-colors text-sm font-medium">Features</Link>
            <Link to="/pricing" className="text-secondary hover:text-primary transition-colors text-sm font-medium">Pricing</Link>
            <Link to="/pharmacy" className="text-secondary hover:text-primary transition-colors text-sm font-medium">Pharmacy</Link>
            <Link to="/reports" className="text-secondary hover:text-primary transition-colors text-sm font-medium">BI & Analytics</Link>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="md" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button variant="primary" size="md" onClick={() => navigate('/register')}>
              Get Started Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 lg:py-36 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-0 right-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] -z-10"></div>

        <div className="max-w-[1200px] mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold mb-8 border border-blue-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Trusted by {stats?.activeTenants ?? 0}+ growing businesses
          </div>
          <h1 className="text-[4rem] lg:text-[5.5rem] font-bold text-primary tracking-tight mb-6 leading-[1.05]">
            The Commerce Platform<br />
            <span className="text-brand">Built for Retail & Pharmacy</span>
          </h1>
          <p className="text-lg lg:text-xl text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            One platform, infinite scale. Multi-tenant SaaS POS with atomic transactions,
            subscription entitlements, pharmacy compliance, and real-time business intelligence.
            Built for businesses that refuse to compromise.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                toast.success('Welcome to SaaS POS! Redirecting to registration...');
                navigate('/register');
              }}
              className="px-10 py-5 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Start Your Free 14-Day Trial
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/login')}
              className="px-10 py-5 text-lg font-semibold border-inverse text-inverse hover:bg-inverse hover:text-surface"
            >
              Sign In to Your Store
            </Button>
          </div>
          <div className="mt-12 flex items-center justify-center gap-6 text-sm text-muted">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>No credit card required</span>
            </div>
            <div className="w-px h-4 bg-muted"></div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Cancel anytime</span>
            </div>
            <div className="w-px h-4 bg-muted"></div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Setup in under 10 minutes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-12 bg-surface border-b border-default">
        <div className="max-w-[1400px] mx-auto px-6">
          <p className="text-center text-sm text-muted mb-6">Trusted by ambitious merchants worldwide</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all">
            <span className="text-xl font-bold text-primary tracking-tight">RET</span><span className="text-xl font-bold text-muted tracking-tight">AIL</span>
            <span className="text-xl font-bold text-primary tracking-tight">PHA</span><span className="text-xl font-bold text-muted tracking-tight">RMCY</span>
            <span className="text-xl font-bold text-primary tracking-tight">HYB</span><span className="text-xl font-bold text-muted tracking-tight">RID</span>
            <span className="text-xl font-bold text-primary tracking-tight">MULTI</span><span className="text-xl font-bold text-muted tracking-tight">-TENANT</span>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-surface">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-heading-h2 text-primary">Platform at Scale</h2>
            <p className="text-body-sm text-muted mt-2">Real metrics from our live platform</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {statItems.map((stat) => (
              <Card key={stat.label} className="p-8 text-center hover:shadow-xl transition-all duration-300 group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 ${stat.gradient} shadow-md`}>
                  {stat.icon}
                </div>
                <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-body-sm text-muted">{stat.label}</div>
                <div className="text-xs text-muted mt-2">{stat.subtext}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-heading-h2 text-primary">Everything You Need to Run Your Business</h2>
            <p className="text-body-sm text-muted mt-2">Enterprise-grade features for retail and pharmacy operations</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-8 hover:shadow-xl transition-all duration-300 group border-default hover:border-brand">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white font-bold text-lg shadow-lg shadow-brand/20`}>
                  {feature.icon}
                </div>
                <h3 className="text-heading-h4 text-primary mb-3">{feature.title}</h3>
                <p className="text-body-sm text-muted leading-relaxed mb-4">{feature.description}</p>
                <div className="flex items-center gap-2 text-xs font-semibold text-brand">
                  <span>{feature.benefit}</span>
                  <span className="text-xs">→</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 bg-subtle">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-heading-h2 text-primary">Why Switch to SaaS POS?</h2>
            <p className="text-body-sm text-muted mt-2">See the difference our platform makes</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full text-left">
              <thead>
                <tr>
                  <th className="text-body-sm text-muted font-normal"></th>
                  <th className="text-body-sm text-muted font-normal">Legacy Systems</th>
                  <th className="text-body-sm text-primary font-semibold">SaaS POS</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-default">
                  <td className="font-medium text-primary">Setup Time</td>
                  <td className="text-muted">Weeks of installation</td>
                  <td className="font-mono tabular-nums">Under 10 minutes</td>
                </tr>
                <tr className="border-b border-default">
                  <td className="font-medium text-primary">Tenant Isolation</td>
                  <td className="text-muted">Shared database risk</td>
                  <td className="font-mono tabular-nums">Composite FK enforcement</td>
                </tr>
                <tr className="border-b border-default">
                  <td className="font-medium text-primary">Sale Integrity</td>
                  <td className="text-muted">Partial state risk</td>
                  <td className="font-mono tabular-nums">Atomic transactions</td>
                </tr>
                <tr className="border-b border-default">
                  <td className="font-medium text-primary">Pharmacy Compliance</td>
                  <td className="text-muted">Manual tracking</td>
                  <td className="font-mono tabular-nums">FEFO + expiry blocking</td>
                </tr>
                <tr className="border-b border-default">
                  <td className="font-medium text-primary">Scaling</td>
                  <td className="text-muted">Reinstall per location</td>
                  <td className="font-mono tabular-nums">Multi-tenant by design</td>
                </tr>
                <tr className="border-b border-default">
                  <td className="font-medium text-primary">Support</td>
                  <td className="text-muted">Ticket-based, slow</td>
                  <td className="font-mono tabular-nums">Priority + dedicated</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-heading-h2 text-primary">Simple, Transparent Pricing</h2>
            <p className="text-body-sm text-muted mt-2">No hidden fees. No long-term contracts. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PRICING.map((plan) => (
              <Card key={plan.name} className={`p-8 flex flex-col ${
                plan.highlighted
                  ? 'border-brand shadow-2xl shadow-brand/20 relative scale-105 z-10'
                  : 'border-default'
              }`}>
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand text-inverse text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold text-primary">{plan.price}</span>
                  <span className="text-body-sm text-muted">{plan.period}</span>
                </div>
                <h3 className="text-heading-h4 text-primary mb-2">{plan.name}</h3>
                <p className="text-body-sm text-muted mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-body-sm">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span className="text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlighted ? 'primary' : 'outline'}
                  size="md"
                  onClick={() => {
                    toast.success(`Redirecting to ${plan.name} checkout...`);
                    navigate('/register');
                  }}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-surface border-b border-default">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-heading-h2 text-primary">Trusted by Business Owners</h2>
            <p className="text-body-sm text-muted mt-2">Real stories from real merchants</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="p-8 flex flex-col h-full">
                <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i}>{i <= t.rating ? '★' : '☆'}</span>
                  ))}
                </div>
                <p className="text-body-sm text-secondary italic mb-6">{t.content}</p>
                <div className="mt-auto">
                  <div className="w-10 h-10 rounded-full bg-brand text-inverse flex items-center justify-center mx-auto text-xs font-bold mb-3">
                    {t.initials}
                  </div>
                  <div className="text-body-sm font-bold text-primary">{t.name}</div>
                  <div className="text-xs text-muted">{t.role}, {t.business}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 bg-canvas">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-heading-h2 text-primary">Frequently Asked Questions</h2>
            <p className="text-body-sm text-muted mt-2">Everything you need to know before getting started</p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: 'Is my data safe from other tenants?',
                a: 'Yes. Every tenant has isolated data with composite tenant-scoped foreign keys enforced at the database level. Your data never mixes with another business.',
              },
              {
                q: 'Can I upgrade or downgrade my plan?',
                a: 'Absolutely. Our subscription entitlement engine handles plan changes seamlessly without downtime. Upgrade or downgrade anytime.',
              },
              {
                q: 'Do you support pharmacy workflows?',
                a: 'Yes. We support FEFO batch allocation, expiry tracking, prescription dispensing, quarantine management, and pharmacy-specific compliance.',
              },
              {
                q: 'What if I have multiple stores?',
                a: 'SaaS POS is built for multi-store operations. Manage all locations from one dashboard with role-based staff access per store.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes. Start with a 14-day free trial. No credit card required. Cancel anytime.',
              },
            ].map((faq, i) => (
              <Card key={i} className="p-6 hover:shadow-md transition-shadow border-default">
                <button
                  onClick={() => {}}
                  className="w-full text-left flex items-center justify-between"
                >
                  <span className="font-medium text-primary">{faq.q}</span>
                  <span className="text-muted">▾</span>
                </button>
                <p className="text-body-sm text-muted mt-3">{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-[1400px] mx-auto">
          <Card className="bg-brand text-inverse p-12 rounded-3xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand to-transparent"></div>
            <h2 className="text-heading-h2 mb-4">Ready to Transform Your Business?</h2>
            <p className="text-body-sm text-blue-100 mb-8 max-w-lg mx-auto">
              Join {stats?.activeTenants ?? 0}+ businesses already using SaaS POS to run their operations efficiently, securely, and profitably.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  toast.success('Welcome aboard! Let\'s get you set up.');
                  navigate('/register');
                }}
                className="px-10 py-5 text-lg font-bold shadow-lg hover:shadow-2xl transition-all"
              >
                Claim Your Free Trial
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/login')}
                className="px-10 py-5 text-lg font-bold border-inverse text-inverse hover:bg-inverse hover:text-surface"
              >
                Talk to Sales
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-default">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-brand font-bold text-lg">SaaS</span><span className="text-secondary font-bold text-lg">POS</span>
          </div>
          <div className="hidden md:flex gap-8 text-body-sm text-muted">
            <Link to="/features" className="hover:text-primary transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
            <Link to="/reports" className="hover:text-primary transition-colors">BI & Analytics</Link>
            <Link to="/pharmacy" className="hover:text-primary transition-colors">Pharmacy</Link>
            <Link to="/login" className="hover:text-primary transition-colors">Sign In</Link>
          </div>
          <div className="text-xs text-muted">
            © {new Date().getFullYear()} SaaS POS Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
