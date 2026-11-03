export const BUSINESS_TIME_ZONE = 'Africa/Dar_es_Salaam';

export function formatTzs(value: number | string | null | undefined): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseBusinessDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const dateValue = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00.000Z`)
      : new Date(value);
  return Number.isFinite(dateValue.getTime()) ? dateValue : null;
}

export function formatBusinessDate(value: string | Date | null | undefined): string {
  const date = parseBusinessDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-TZ', {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'medium',
  }).format(date);
}

export function formatBusinessDateTime(value: string | Date | null | undefined): string {
  const date = parseBusinessDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-TZ', {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function getBusinessDateInputValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getBusinessMonthStartInputValue(date = new Date()): string {
  return `${getBusinessDateInputValue(date).slice(0, 7)}-01`;
}
