import { tokens } from '../../lib/design-tokens';
import { Spinner } from './Spinner';

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading...', className = '', ...props }: LoadingStateProps) {
  return (
    <div className={`state-loading ${className}`} {...props}>
      <Spinner size="lg" className="text-brand" />
      <p className="text-body-md text-muted">{message}</p>
    </div>
  );
}
