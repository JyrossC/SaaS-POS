import { tokens } from '../../lib/design-tokens';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
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
      {...props}
    >
      {isLoading ? (
        <>
          <span className="spinner" style={{ width: 16, height: 16, borderWidth: '2px' }} />
          <span className="text-muted text-body-sm">Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
