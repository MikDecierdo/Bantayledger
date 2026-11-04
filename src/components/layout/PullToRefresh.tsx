import { IonIcon } from '@ionic/react';
import { refreshOutline } from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import { DATA_CHANGED_EVENT } from '../../services/offline/status';
import './PullToRefresh.css';

/** How far to pull (in px, after slowing the finger down) before letting go refreshes. */
const TRIGGER = 64;
const MAX_PULL = 90;
/** Long enough to see that something happened. */
const SPIN_MS = 700;

/**
 * Pull the page down from the top to fetch fresh numbers, as in most phone apps.
 * Pages already reload on DATA_CHANGED_EVENT, so this only has to send it. Only
 * touch screens ever pull, so larger screens are unaffected.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const startY = useRef<number | null>(null);
  const current = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const main = document.getElementById('bl-main');
    if (!main) return;

    const onStart = (e: TouchEvent) => {
      startY.current = main.scrollTop <= 0 && !busy.current && e.touches.length === 1 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const distance = e.touches[0].clientY - startY.current;
      if (distance <= 0 || main.scrollTop > 0) {
        startY.current = null;
        current.current = 0;
        setPull(0);
        return;
      }
      current.current = Math.min(MAX_PULL, distance * 0.5);
      setPull(current.current);
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      const reached = current.current >= TRIGGER;
      current.current = 0;
      setPull(0);
      if (!reached) return;
      busy.current = true;
      setSpinning(true);
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
      window.setTimeout(() => {
        busy.current = false;
        setSpinning(false);
      }, SPIN_MS);
    };

    main.addEventListener('touchstart', onStart, { passive: true });
    main.addEventListener('touchmove', onMove, { passive: true });
    main.addEventListener('touchend', onEnd);
    main.addEventListener('touchcancel', onEnd);
    return () => {
      main.removeEventListener('touchstart', onStart);
      main.removeEventListener('touchmove', onMove);
      main.removeEventListener('touchend', onEnd);
      main.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (!pull && !spinning) return null;

  return (
    <div
      className={`bl-ptr${spinning ? ' is-spinning' : ''}${pull >= TRIGGER ? ' is-ready' : ''}`}
      style={spinning ? undefined : { transform: `translate(-50%, ${pull}px) rotate(${pull * 4}deg)` }}
      aria-hidden="true"
    >
      <IonIcon icon={refreshOutline} />
    </div>
  );
}

export default PullToRefresh;
