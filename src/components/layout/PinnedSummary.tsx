import { useEffect, useRef, type ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import './PinnedSummary.css';

/**
 * A row of summary cards that pins under the page header on desktop and
 * shrinks as the page scrolls.
 *
 * Size is a pure function of scrollTop — `--p` runs 0 → 1 over the distance
 * the block can shrink — so scrolling back up grows it again. The block keeps
 * a constant footprint in the page flow (margin-bottom makes up the
 * difference), so shrinking never moves the content below or fights the
 * browser's scroll anchoring. That is what keeps it free of jitter.
 *
 * It also publishes `--bl-sticky-top` on the scroll container so a sticky
 * filter bar or table heading further down stacks directly beneath it.
 * Below 1024px it renders its children plainly.
 */
export function PinnedSummary({ children }: { children: ReactNode }) {
  const { isDesktop } = useBreakpoint();
  const anchorRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const main = document.getElementById('bl-main');
    const pin = pinRef.current;
    const anchor = anchorRef.current;
    if (!isDesktop || !main || !pin || !anchor) return;

    const headerH =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bl-header-h')) || 84;
    let fullH = 0; // pin height at --p: 0
    let distance = 1; // px of scroll over which it shrinks
    let stickAt = 0; // scrollTop at which the pin docks under the header
    let frame = 0;

    const update = () => {
      frame = 0;
      const p = Math.min(1, Math.max(0, (main.scrollTop - stickAt) / distance));
      pin.style.setProperty('--p', p.toFixed(4));
      const h = pin.offsetHeight;
      main.style.setProperty('--bl-sticky-top', `${headerH + h}px`);
      pin.style.marginBottom = `${Math.max(0, fullH - h)}px`;
    };

    const measure = () => {
      pin.style.marginBottom = '0px';
      pin.style.setProperty('--p', '0');
      fullH = pin.offsetHeight;
      pin.style.setProperty('--p', '1');
      distance = Math.max(40, fullH - pin.offsetHeight);
      const anchorTop = anchor.getBoundingClientRect().top - main.getBoundingClientRect().top;
      stickAt = Math.max(0, anchorTop + main.scrollTop - headerH);
      update();
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    measure();
    // Fonts and images can change the full height just after mount.
    const settle = window.setTimeout(measure, 250);
    main.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(settle);
      main.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      if (frame) cancelAnimationFrame(frame);
      main.style.removeProperty('--bl-sticky-top');
      pin.style.removeProperty('--p');
      pin.style.removeProperty('margin-bottom');
    };
  }, [isDesktop]);

  return (
    <>
      <div ref={anchorRef} aria-hidden="true" style={{ height: 0 }} />
      <div ref={pinRef} className="bl-pin">
        {children}
      </div>
    </>
  );
}

export default PinnedSummary;
