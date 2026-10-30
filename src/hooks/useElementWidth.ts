import { useEffect, useRef, useState } from 'react';

/**
 * Measures a container so charts can render at real pixel size.
 *
 * Scaling a fixed viewBox would stretch the labels; rendering to the measured
 * width keeps axis text at a readable size on every breakpoint.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });

    observer.observe(el);
    setWidth(el.getBoundingClientRect().width || fallback);

    return () => observer.disconnect();
  }, [fallback]);

  return [ref, width] as const;
}
