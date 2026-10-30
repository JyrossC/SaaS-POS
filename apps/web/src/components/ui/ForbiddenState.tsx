import { tokens } from '../../lib/design-tokens';

interface ForbiddenStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ForbiddenState({
  title = 'Access denied',
  description = 'Your current account does not have permission to view this page.',
  action,
  className = '',
  ...props
}: ForbiddenStateProps) {
  return (
    <div className={`state-forbidden ${className}`} {...props}>
      <p className="text-heading-h4 text-danger">{title}</p>
      <p className="text-body-md text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
