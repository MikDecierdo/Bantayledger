import { IonIcon } from '@ionic/react';
import { chevronForwardOutline } from 'ionicons/icons';
import type { ReactNode } from 'react';
import './MobileRow.css';

interface MobileRowProps {
  /** A picture or initials on the left. */
  lead?: ReactNode;
  title: ReactNode;
  /** One short line under the title. */
  meta?: ReactNode;
  /** The figure or status that matters, on the right. */
  value?: ReactNode;
  /** A small note under the value. */
  valueNote?: ReactNode;
  /** Opens this item's details; without it the row is plain text. */
  onClick?: () => void;
  /** Names the whole row for screen readers when it opens something. */
  ariaLabel?: string;
  /** An action that can't wait for the details page, shown under the row. */
  action?: ReactNode;
}

/**
 * One line of a list on a phone: short enough that several fit on screen, with the
 * whole row as the button and everything else on the item's details page.
 */
export function MobileRow({ lead, title, meta, value, valueNote, onClick, ariaLabel, action }: MobileRowProps) {
  const body = (
    <>
      {lead && <span className="bl-mrow__lead">{lead}</span>}
      <span className="bl-mrow__text">
        <span className="bl-mrow__title">{title}</span>
        {meta && <span className="bl-mrow__meta">{meta}</span>}
      </span>
      {(value || valueNote) && (
        <span className="bl-mrow__end">
          {value && <span className="bl-mrow__value">{value}</span>}
          {valueNote && <span className="bl-mrow__note">{valueNote}</span>}
        </span>
      )}
      {onClick && <IonIcon icon={chevronForwardOutline} className="bl-mrow__chev" aria-hidden="true" />}
    </>
  );

  return (
    <div className="bl-mrow-wrap">
      {onClick ? (
        <button type="button" className="bl-mrow bl-mrow--tap" onClick={onClick} aria-label={ariaLabel}>
          {body}
        </button>
      ) : (
        <div className="bl-mrow">{body}</div>
      )}
      {action && <div className="bl-mrow__action">{action}</div>}
    </div>
  );
}

export default MobileRow;
