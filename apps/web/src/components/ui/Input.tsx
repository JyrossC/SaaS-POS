import { tokens } from '../../lib/design-tokens';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export function Input({ error, label, className = '', ...props }: InputProps) {
  return (
    <div className="form-field">
      {label && (
        <label className="text-label-md text-secondary" htmlFor={props.id}>
          {label}
        </label>
      )}
      <input
        className={`input ${error ? 'input.error' : ''} ${className}`}
        {...props}
      />
      {error && (
        <span className="text-danger text-caption">{error}</span>
      )}
    </div>
  );
}
