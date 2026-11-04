import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import './Ticker.css';

interface TickerProps {
  text: string;
  className?: string;
}

/** Pixels per second the text moves at, so long and short overflows read at the same pace. */
const SPEED = 40;

/**
 * One line of text that scrolls sideways, like a news ticker, only when it's too
 * long for its space. It glides to the end, waits, glides back, and repeats, so the
 * text never disappears. Text that fits stays still. With reduced motion it stays
 * still and ends in "…"; the full text is always in the tooltip.
 */
export function Ticker({ text, className }: TickerProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setOverflow(Math.max(0, Math.ceil(box.scrollWidth - box.clientWidth)));
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(box);
    return () => resized.disconnect();
  }, [text]);

  const moving = overflow > 2;
  // The glide each way, plus a pause at each end (the keyframes hold for 40% of the loop).
  const glide = Math.max(1.5, (overflow + 16) / SPEED);
  const style = moving
    ? ({ '--bl-ticker-shift': `-${overflow + 16}px`, '--bl-ticker-time': `${(glide * 2) / 0.6}s` } as CSSProperties)
    : undefined;

  return (
    <span ref={boxRef} className={`bl-ticker${moving ? ' is-moving' : ''}${className ? ` ${className}` : ''}`} title={text} style={style}>
      <span className="bl-ticker__text">
        {text}
      </span>
    </span>
  );
}

export default Ticker;
