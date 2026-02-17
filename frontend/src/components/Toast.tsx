import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const notify = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts(previous => [...previous.slice(-3), { id, message }]);
    window.setTimeout(() => setToasts(previous => previous.filter(item => item.id !== id)), 5000);
  }, []);
  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toasts" aria-live="polite">
      {toasts.map(toast => <div className="toast" key={toast.id}>
        <CheckCircle2 size={18} />
        <span>{toast.message}</span>
        <button className="icon-button" aria-label="Dismiss notification"
          onClick={() => setToasts(previous => previous.filter(item => item.id !== toast.id))}>
          <X size={16} />
        </button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
