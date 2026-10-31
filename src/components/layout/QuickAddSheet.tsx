import { IonIcon } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { quickAddItems } from './navItems';
import './MoreSheet.css';
import { t } from '../../i18n';

interface QuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The bottom bar's "+": one list of everything you can record, each opening
 * that page with its Add window already open (the `openAdd` route state the
 * pages listen for).
 */
export function QuickAddSheet({ isOpen, onClose }: QuickAddSheetProps) {
  const history = useHistory();

  const go = (href: string) => {
    onClose();
    history.push(href, { openAdd: true });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('Quick add')} icon="form" size="sm">
      <ul className="bl-more__list">
        {quickAddItems.map((item) => (
          <li key={item.href}>
            <button type="button" className="bl-more__item" onClick={() => go(item.href)}>
              <span className="bl-more__icon" aria-hidden="true">
                <IonIcon icon={item.icon} />
              </span>
              <span className="bl-more__label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default QuickAddSheet;
