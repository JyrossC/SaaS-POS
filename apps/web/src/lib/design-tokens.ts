/**
 * SaaS POS Cloud — Design Tokens & UI Behavior
 * Document: SEC-DS-001 v1.0.0
 *
 * Centralized design token constants mapped to CSS custom properties.
 * All component styles should reference these semantic tokens rather than
 * hard-coded arbitrary values.
 */

/* --- Spacing --- */
export const spacing = {
  0: 'var(--spacing-0)',
  1: 'var(--spacing-1)',
  2: 'var(--spacing-2)',
  3: 'var(--spacing-3)',
  4: 'var(--spacing-4)',
  5: 'var(--spacing-5)',
  6: 'var(--spacing-6)',
  8: 'var(--spacing-8)',
  10: 'var(--spacing-10)',
  12: 'var(--spacing-12)',
} as const;

/* --- Radius --- */
export const radius = {
  none: 'var(--radius-none)',
  xs: 'var(--radius-xs)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: 'var(--radius-full)',
} as const;

/* --- Duration --- */
export const duration = {
  instant: 'var(--duration-instant)',
  fast: 'var(--duration-fast)',
  standard: 'var(--duration-standard)',
  slow: 'var(--duration-slow)',
  overlay: 'var(--duration-overlay)',
} as const;

/* --- Dimensions --- */
export const size = {
  iconSm: 'var(--size-icon-sm)',
  iconMd: 'var(--size-icon-md)',
  iconLg: 'var(--size-icon-lg)',
  controlSm: 'var(--size-control-sm)',
  controlMd: 'var(--size-control-md)',
  controlLg: 'var(--size-control-lg)',
  sidebarExpanded: 'var(--size-sidebar-expanded)',
  sidebarCollapsed: 'var(--size-sidebar-collapsed)',
  topbar: 'var(--size-topbar)',
  contentMax: 'var(--layout-content-max)',
} as const;

/* --- Colors (semantic) --- */
export const colors = {
  // Backgrounds
  bgCanvas: 'var(--color-bg-canvas)',
  bgSurface: 'var(--color-bg-surface)',
  bgSubtle: 'var(--color-bg-subtle)',
  bgBrand: 'var(--color-bg-brand)',
  bgBrandHover: 'var(--color-bg-brand-hover)',
  bgSelected: 'var(--color-bg-selected)',
  bgSuccess: 'var(--color-bg-success)',
  bgWarning: 'var(--color-bg-warning)',
  bgDanger: 'var(--color-bg-danger)',
  bgCritical: 'var(--color-bg-critical)',

  // Text
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  textBrand: 'var(--color-text-brand)',
  textSuccess: 'var(--color-text-success)',
  textWarning: 'var(--color-text-warning)',
  textDanger: 'var(--color-text-danger)',
  textInverse: 'var(--color-text-inverse)',

  // Borders
  borderDefault: 'var(--color-border-default)',
  borderStrong: 'var(--color-border-strong)',
  borderFocus: 'var(--color-border-focus)',
  borderDanger: 'var(--color-border-danger)',

  // Icons
  iconPrimary: 'var(--color-icon-primary)',
  iconSecondary: 'var(--color-icon-secondary)',
  iconBrand: 'var(--color-icon-brand)',

  // Shadows
  shadowSm: 'var(--shadow-sm)',
  shadowMd: 'var(--shadow-md)',
  shadowLg: 'var(--shadow-lg)',
} as const;

/* --- Typography --- */
export const typography = {
  displayLg: 'text-display-lg',
  headingH1: 'text-heading-h1',
  headingH2: 'text-heading-h2',
  headingH3: 'text-heading-h3',
  headingH4: 'text-heading-h4',
  titleLg: 'text-title-lg',
  titleMd: 'text-title-md',
  bodyLg: 'text-body-lg',
  bodyMd: 'text-body-md',
  bodySm: 'text-body-sm',
  labelMd: 'text-label-md',
  labelSm: 'text-label-sm',
  caption: 'text-caption',
  overline: 'text-overline',
} as const;

/* --- Breakpoints --- */
export const breakpoints = {
  mobile: '640px',
  tablet: '1024px',
  desktop: '1440px',
} as const;

/* --- Component variants --- */
export const buttonVariants = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  danger: 'btn-danger',
} as const;

export const buttonSizes = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
} as const;

export const badgeVariants = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
} as const;

export const inputStates = {
  default: 'input',
  error: 'input error',
} as const;

export const tokens = {
  spacing,
  radius,
  duration,
  size,
  colors,
  typography,
  breakpoints,
  buttonVariants,
  buttonSizes,
  badgeVariants,
  inputStates,
} as const;
