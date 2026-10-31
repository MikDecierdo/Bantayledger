import { IonIcon, IonModal } from '@ionic/react';
import {
  bagOutline,
  cartOutline,
  cashOutline,
  closeOutline,
  cubeOutline,
  documentTextOutline,
  gridOutline,
  keyOutline,
  peopleOutline,
  personOutline,
  receiptOutline,
  swapVerticalOutline,
  trashOutline,
  walletOutline,
  warningOutline,
} from 'ionicons/icons';
import type { ReactNode } from 'react';
import { useId } from 'react';
import Button from './Button';
import './Modal.css';
import { t } from '../../i18n';

/** Picture in the header tile, so each window is recognisable at a glance. */
const MODAL_ICONS = {
  expense: walletOutline,
  product: cubeOutline,
  stock: swapVerticalOutline,
  profile: personOutline,
  purchase: bagOutline,
  budget: cashOutline,
  sale: receiptOutline,
  cart: cartOutline,
  supplier: peopleOutline,
  waste: trashOutline,
  team: peopleOutline,
  password: keyOutline,
  warning: warningOutline,
  form: documentTextOutline,
  menu: gridOutline,
} as const;

export type ModalIconName = keyof typeof MODAL_ICONS;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** `sm` hugs its content, `md`/`lg` use a scrollable body. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Header picture; defaults to a generic form icon (warning for the danger tone). */
  icon?: ModalIconName;
  /** `danger` tints the window red, for confirmations that delete or sign out. */
  tone?: 'brand' | 'danger';
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  icon,
  tone = 'brand',
  children,
  footer,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className={`bl-modal bl-modal--${size} bl-modal--${tone}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <div className="bl-modal__shell">
        <span className="bl-modal__grip" aria-hidden="true" />
        <header className="bl-modal__header">
          <span className="bl-modal__icon" aria-hidden="true">
            <IonIcon icon={MODAL_ICONS[icon ?? (tone === 'danger' ? 'warning' : 'form')]} />
          </span>
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
      tone={tone === 'danger' ? 'danger' : 'brand'}
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
