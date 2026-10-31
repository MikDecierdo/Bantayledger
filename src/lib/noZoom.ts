/**
 * Keeps the app at a fixed size on phones and tablets, like a native app.
 *
 * iPhone Safari ignores `user-scalable=no` in the viewport tag, so pinch
 * zoom is blocked here: Safari's own gesture events, plus any two-finger
 * touch move. Double-tap zoom is turned off in CSS (`touch-action:
 * manipulation` in theme/base.css), and `maximum-scale=1` in index.html stops
 * Safari zooming in when a text box is tapped. Desktop browser zoom
 * (Ctrl + / Ctrl −) is left alone.
 */
export function preventZoom(): void {
  if (typeof document === 'undefined') return;
  const block = (e: Event) => e.preventDefault();

  // Safari (iPhone / iPad) pinch gestures.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, block, { passive: false });
  }

  // Any other two-finger pinch on a touch screen.
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
}
