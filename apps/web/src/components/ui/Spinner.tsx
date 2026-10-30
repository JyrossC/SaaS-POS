import { tokens } from '../../lib/design-tokens';

interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '', ...props }: SpinnerProps) {
  const sizeMap = {
    sm: tokens.size.iconSm,
    md: tokens.size.iconMd,
    lg: tokens.size.iconLg,
  };
  return (
    <svg
      className={`spinner ${className}`}
      width={sizeMap[size] as unknown as number}
      height={sizeMap[size] as unknown as number}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="animate-spin"
      />
    </svg>
  );
}
