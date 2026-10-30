import { tokens } from '../../lib/design-tokens';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'No data available',
  description,
  action,
  className = '',
  ...props
}: EmptyStateProps) {
  return (
    <div className={`state-empty ${className}`} {...props}>
      <p className="text-heading-h4 text-secondary">{title}</p>
      {description && <p className="text-body-md text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
