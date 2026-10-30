import { IonIcon } from '@ionic/react';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  closeOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import './ToastProvider.css';
import { t } from '../../i18n';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi>({ showToast: () => undefined });

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

const TONE_ICON: Record<ToastTone, string> = {
  success: checkmarkCircleOutline,
  error: alertCircleOutline,
  info: informationCircleOutline,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="bl-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`bl-toast bl-toast--${toast.tone}`}>
            <IonIcon icon={TONE_ICON[toast.tone]} aria-hidden="true" className="bl-toast__icon" />
            <span className="bl-toast__msg">{toast.message}</span>
            <button
              type="button"
              className="bl-toast__close"
              onClick={() => dismiss(toast.id)}
              aria-label={t('Dismiss notification')}
            >
              <IonIcon icon={closeOutline} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
