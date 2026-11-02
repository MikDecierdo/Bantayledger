/**
 * The opening of the Android and Windows apps lives in index.html, so it paints
 * before the app's code loads. These tell it what is happening. index.html also
 * moves on by itself after a few seconds, so a slow server can't leave anyone
 * stuck on it.
 */
type SplashWindow = { __blSplashPlay?: () => void; __blSplashLeave?: () => void };

/** The code has loaded and the page can animate smoothly. */
export function playSplash(): void {
  (window as SplashWindow).__blSplashPlay?.();
}

/** The sign-in check is done, so the app can show once the animation has played. */
export function finishSplash(): void {
  (window as SplashWindow).__blSplashLeave?.();
}
