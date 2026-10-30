export interface SubscriptionDetails {
  id: string;
  planCode: string;
  planName: string;
  planVersion: number;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  trialEndsAt: Date | null;
  isCurrent: boolean;
  entitlements: Record<string, unknown>;
  limits: Record<string, number>;
  moduleSettings: Record<string, boolean>;
}

export interface ChangePlanRequest {
  planCode: string;
}

export interface RenewSubscriptionRequest {
  planCode?: string;
}

export interface SubscriptionInvoiceSummary {
  id: string;
  amount: number;
  currency: string;
  status: string;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface SubscriptionPaymentSummary {
  id: string;
  amount: number;
  currency: string;
  status: string;
  providerReference: string | null;
  createdAt: Date;
}
