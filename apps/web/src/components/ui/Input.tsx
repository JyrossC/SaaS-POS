import { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export function Input({ error, label, hint, className = '', ...props }: InputProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [props['aria-describedby'], hint ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="form-field">
      {label && (
        <label className="text-label-md text-secondary" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        className={`input ${error ? 'error' : ''} ${className}`}
        {...props}
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
      />
      {hint && <span id={hintId} className="text-caption text-muted">{hint}</span>}
      {error && (
        <span id={errorId} role="alert" className="input-error text-caption">
          <span aria-hidden="true">!</span>
          {error}
        </span>
      )}
    </div>
  );
}
