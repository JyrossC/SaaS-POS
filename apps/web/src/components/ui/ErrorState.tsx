import { tokens } from '../../lib/design-tokens';

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
  className = '',
  ...props
}: ErrorStateProps) {
  return (
    <div className={`state-error ${className}`} {...props}>
      <p className="text-heading-h4 text-danger">{title}</p>
      {description && <p className="text-body-md text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
