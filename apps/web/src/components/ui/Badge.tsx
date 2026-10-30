import { tokens } from '../../lib/design-tokens';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'success', children, className = '', ...props }: BadgeProps) {
  return (
    <span className={`badge ${tokens.badgeVariants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
