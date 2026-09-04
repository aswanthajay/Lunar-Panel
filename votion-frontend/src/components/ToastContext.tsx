import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] max-w-[92vw] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-[#1a1a1a] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse shrink-0"></span>
            <span className="truncate">{toast}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
