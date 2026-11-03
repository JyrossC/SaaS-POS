import { tokens } from '../../lib/design-tokens';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingLabel?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingLabel = 'Loading',
  disabled = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseCls = `btn ${tokens.buttonVariants[variant]} ${tokens.buttonSizes[size]}`;
  return (
    <button
      className={`${baseCls} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="spinner button-spinner" aria-hidden="true" />
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
