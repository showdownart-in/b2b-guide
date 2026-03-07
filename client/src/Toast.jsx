import { createContext, useCallback, useState, useContext } from 'react';

export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', type: 'success', show: false });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, show: true });
    const t = setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}
        role="alert"
        aria-live="polite"
      >
        {toast.message}
      </div>
    </ToastContext.Provider>
  );
}
