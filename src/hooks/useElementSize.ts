import { useEffect, useRef, useState } from 'react';

/**
 * Measures a container's width and height so a chart can fill a card whose
 * height is set by the page layout (desktop "fit" mode) rather than by its
 * content.
 */
export function useElementSize<T extends HTMLElement>(fallbackWidth = 640) {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: fallbackWidth, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0) return;
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    });

    observer.observe(el);
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width || fallbackWidth, height: rect.height });

    return () => observer.disconnect();
  }, [fallbackWidth]);

  return [ref, size.width, size.height] as const;
}
