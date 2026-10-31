import { useEffect, useState } from 'react';

/** Breakpoints used across the app. Keep in sync with the CSS media queries. */
export const BREAKPOINTS = {
  /** Phones. */
  mobile: 0,
  /** Small tablets — compact rail navigation appears. */
  tablet: 768,
  /** Full sidebar appears. */
  desktop: 1024,
  /** Wider content grids. */
  wide: 1440,
} as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

function resolve(width: number): Breakpoint {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

export function useBreakpoint() {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const bp = resolve(width);

  return {
    width,
    breakpoint: bp,
    isMobile: bp === 'mobile',
    isTablet: bp === 'tablet',
    /** True at >= 1024px, where the full sidebar is shown. */
    isDesktop: bp === 'desktop' || bp === 'wide',
    /** True below 768px, where bottom navigation is used. */
    usesBottomNav: bp === 'mobile',
  };
}

/**
 * Desktop "fit" mode: wide and tall enough for pages to fill the window
 * without scrolling (see components/layout/Workspace.css). Keep in sync with
 * the CSS media queries.
 */
export const FIT_QUERY = '(min-width: 1024px) and (min-height: 640px)';

export function useFitMode() {
  const [fit, setFit] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(FIT_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(FIT_QUERY);
    const onChange = () => setFit(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return fit;
}
