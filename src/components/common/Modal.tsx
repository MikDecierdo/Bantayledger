import { IonIcon, IonModal } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import type { ReactNode } from 'react';
import { useId } from 'react';
import Button from './Button';
import './Modal.css';
import { t } from '../../i18n';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** `sm` hugs its content, `md`/`lg` use a scrollable body. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className={`bl-modal bl-modal--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <div className="bl-modal__shell">
        <header className="bl-modal__header">
          <div className="bl-modal__header-text">
            <h2 className="bl-section-title" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="bl-caption" id={descId}>
                {description}
              </p>
            )}
          </div>
          <button type="button" className="bl-modal__close" onClick={onClose} aria-label={t('Close dialog')}>
            <IonIcon icon={closeOutline} aria-hidden="true" />
          </button>
        </header>

        <div className="bl-modal__body bl-scroll">{children}</div>

        {footer && <footer className="bl-modal__footer">{footer}</footer>}
      </div>
    </IonModal>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = t('Confirm'),
  cancelLabel = t('Cancel'),
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="bl-support">{message}</p>
    </Modal>
  );
}

export default Modal;
