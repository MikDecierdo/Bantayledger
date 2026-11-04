import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useToast } from '../common/ToastProvider';
import { t } from '../../i18n';

/** Priority in Ionic's back-button queue: above its page handler, below open windows (100). */
const PAGE_PRIORITY = 50;
/** How long a second press counts as "yes, leave the app". */
const EXIT_WINDOW_MS = 2500;

/** The pages at the top of the app: back from these heads home, then out. */
const HOME_PAGES = ['/dashboard', '/login', '/'];

/**
 * The Android back button, in the order people expect: close the message or window
 * that's open, go back a page, return to Home, and only then leave the app, after
 * saying so once. Ionic closes its own open windows; this handles the rest.
 * Does nothing outside the installed app.
 */
export function AndroidBackButton() {
  const history = useHistory();
  const { pathname } = useLocation();
  const { showToast } = useToast();
  const lastPress = useRef(0);
  const current = useRef({ pathname, showToast });
  current.current = { pathname, showToast };

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    // Ionic only passes the button on once the app is listening for it.
    const listener = NativeApp.addListener('backButton', () => undefined);

    const onBack = (event: Event) => {
      const { register } = (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail;

      register(PAGE_PRIORITY, () => {
        const { pathname: page, showToast: toast } = current.current;
        if (!HOME_PAGES.includes(page)) {
          if (history.length > 1) history.goBack();
          else history.replace('/dashboard');
          return;
        }
        const now = Date.now();
        if (now - lastPress.current < EXIT_WINDOW_MS) {
          void NativeApp.exitApp();
          return;
        }
        lastPress.current = now;
        toast(t('Press back again to leave the app'));
      });
    };

    // A message on screen is answered first, before Ionic sees the button at all
    // (Ionic doesn't pass the button on while one is showing).
    const onNativeBack = (event: Event) => {
      if (!Swal.isVisible()) return;
      event.stopImmediatePropagation();
      Swal.close();
    };

    document.addEventListener('backbutton', onNativeBack, true);
    document.addEventListener('ionBackButton', onBack);
    return () => {
      document.removeEventListener('backbutton', onNativeBack, true);
      document.removeEventListener('ionBackButton', onBack);
      void listener.then((l) => l.remove());
    };
  }, [history]);

  return null;
}

export default AndroidBackButton;
