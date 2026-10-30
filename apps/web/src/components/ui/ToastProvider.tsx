import { Toaster, toast } from 'react-hot-toast';
import { ReactNode } from 'react';

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#17213a',
            color: '#f8fafc',
            border: '1px solid #2c3a5a',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '14px',
            fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          },
          success: {
            icon: '✅',
          },
          error: {
            icon: '❌',
          },
        }}
      />
      {children}
    </>
  );
}

