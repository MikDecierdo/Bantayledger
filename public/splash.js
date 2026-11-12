/*
 * Only the installed apps show the opening animation: Windows runs at app://,
 * Android at https://localhost. ?blsplash shows it in a browser, to test or demonstrate it.
 */
(function () {
  var root = document.documentElement;
  var splash = document.getElementById('bl-splash');
  var cap = window.Capacitor;
  var inApp =
    location.protocol === 'app:' ||
    (location.protocol === 'https:' && location.hostname === 'localhost') ||
    !!window.bantayledgerDesktop ||
    !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  if (!inApp && !/[?&]blsplash\b/.test(location.search)) {
    splash.remove();
    return;
  }
  root.classList.add('bl-splash-on');
  var PLAY_MS = 1250;
  var playedAt = 0;
  var left = false;
  window.__blSplashPlay = function () {
    if (playedAt) return;
    playedAt = Date.now();
    splash.classList.add('is-playing');
  };
  window.__blSplashLeave = function leave() {
    if (left) return;
    var wait = playedAt ? PLAY_MS - (Date.now() - playedAt) : 100;
    if (wait > 0) {
      setTimeout(leave, wait);
      return;
    }
    left = true;
    splash.classList.add('is-leaving');
    setTimeout(function () {
      splash.remove();
      root.classList.remove('bl-splash-on');
    }, 520);
  };
  // The app normally says when it is ready; this covers a sleeping server or a failure.
  setTimeout(function () {
    window.__blSplashPlay();
    window.__blSplashLeave();
  }, 6000);
})();
