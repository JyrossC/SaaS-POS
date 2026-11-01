import { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export function Input({ error, label, className = '', ...props }: InputProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;

  return (
    <div className="form-field">
      {label && (
        <label className="text-label-md text-secondary" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        className={`input ${error ? 'input.error' : ''} ${className}`}
        {...props}
        id={id}
      />
      {error && (
        <span className="text-danger text-caption">{error}</span>
      )}
    </div>
  );
}
