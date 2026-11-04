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
      {/* The first one, recording a sale, is what people come here for most. */}
      <ul className="bl-more__tiles bl-more__tiles--2">
        {quickAddItems.map((item, index) => (
          <li key={item.href} className={index === 0 ? 'bl-more__tilewide' : undefined}>
            <button type="button" className={`bl-more__tile${index === 0 ? ' bl-more__tile--main' : ''}`} onClick={() => go(item.href)}>
              <IonIcon icon={item.icon} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default QuickAddSheet;
