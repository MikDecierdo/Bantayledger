import Swal, { type SweetAlertOptions, type SweetAlertResult } from 'sweetalert2';
import { t } from '../i18n';

/**
 * Confirmation and result popups, themed to match the app.
 *
 * SweetAlert2's own button styling is switched off (`buttonsStyling: false`)
 * so the popups reuse the real `.bl-btn` classes from `../theme/components.css`
 * — that way the buttons are the app's buttons, not lookalikes that drift the
 * next time the design system changes. Everything else is themed in
 * `../theme/swal.css`.
 *
 * These helpers only *ask* or *announce*. The actual work — deleting, signing
 * out, navigating — stays with the caller, so nothing surprising happens
 * behind a `true`.
 */

/**
 * Ionic's `<ion-modal>` intentionally traps keyboard focus inside itself —
 * necessary for accessibility, but it has no idea SweetAlert2 exists.
 * SweetAlert2 appends its popup to `<body>`, outside any open modal, so the
 * instant it tries to focus its own input, Ionic's trap yanks focus straight
 * back into the modal: the popup renders fine, but nothing you type reaches
 * it. Ionic's own docs name this exact scenario ("presenting non-Ionic
 * overlays from third-party libraries") and the fix is their own escape
 * hatch — the modal's `focusTrap` property, off for as long as the popup is
 * open. Handled once here, centrally, rather than by every call site
 * remembering it.
 */
function openIonModals(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('ion-modal')).filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

/**
 * Every "record saved" flow closes its IonModal and immediately fires a
 * success popup (e.g. `closeModal(); await alertSuccess(...)`). At that
 * instant the modal is still visible and mid-way through Ionic's own exit
 * animation — its `isOpen` prop has already flipped to `false`, but the
 * element hasn't finished leaving yet. Opening SweetAlert2's popup right
 * then makes it fight the modal's exit transition for animation frames, so
 * the success icon's checkmark is left half-drawn (a bare circle) for about
 * a second until things settle. Waiting for the modal to actually finish
 * dismissing before showing the popup avoids the two animations ever
 * overlapping.
 */
function waitForClosingModals(modals: HTMLElement[]): Promise<void> {
  const closing = modals.filter((el) => (el as unknown as { isOpen?: boolean }).isOpen === false);
  if (closing.length === 0) return Promise.resolve();

  return Promise.all(
    closing.map(
      (modal) =>
        new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            modal.removeEventListener('ionModalDidDismiss', finish);
            resolve();
          };
          modal.addEventListener('ionModalDidDismiss', finish, { once: true });
          // Safety net in case the event never fires (e.g. dismiss was cancelled).
          setTimeout(finish, 400);
        }),
    ),
  ).then(() => undefined);
}

async function fireSwal(options: SweetAlertOptions): Promise<SweetAlertResult> {
  await waitForClosingModals(openIonModals());

  // Re-read: any modal that was closing has now fully left the DOM's visible
  // area. What's left is genuinely still open (e.g. a prompt fired from
  // within a modal that stays open, like "+ Add new category").
  const modals = openIonModals();
  // Ionic's Stencil components expose their props as plain JS properties, so
  // this takes effect immediately — no React re-render involved.
  for (const modal of modals) (modal as unknown as { focusTrap: boolean }).focusTrap = false;

  try {
    return await Swal.fire(options);
  } finally {
    for (const modal of modals) (modal as unknown as { focusTrap: boolean }).focusTrap = true;
  }
}

const baseOptions = {
  buttonsStyling: false,
  reverseButtons: true,
  /**
   * Required in this app. By default SweetAlert2 puts `swal2-height-auto` on
   * <html>/<body>, which forces `height: auto !important` — but Ionic's layout
   * needs `html, body { height: 100% }`, so the body collapses to 0px, the
   * popup's own container (height: 100%) collapses with it, and the dialog
   * ends up clipped off the top of the viewport instead of centred.
   */
  heightAuto: false,
} as const;

const classes = {
  popup: 'bl-swal',
  title: 'bl-swal__title',
  htmlContainer: 'bl-swal__text',
  actions: 'bl-swal__actions',
} as const;

export interface ConfirmOptions {
  /** A question naming the thing, e.g. "Delete Cooking Oil 1L?". */
  title: string;
  /** Consequence first, then what survives. */
  text: string;
  /** The bare verb — "Delete", "Log out" — never "Yes"/"OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for anything that destroys data. */
  tone?: 'danger' | 'primary';
}

/** Asks before an action. Resolves true only if the user confirms. */
export async function confirmAction({
  title,
  text,
  confirmLabel,
  cancelLabel = t('Cancel'),
  tone = 'danger',
}: ConfirmOptions): Promise<boolean> {
  const result = await fireSwal({
    ...baseOptions,
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: cancelLabel,
    // Destroying something is not what someone wants from a stray Enter key.
    focusCancel: tone === 'danger',
    customClass: {
      ...classes,
      confirmButton: tone === 'danger' ? 'bl-btn bl-btn--danger' : 'bl-btn bl-btn--primary',
      cancelButton: 'bl-btn bl-btn--secondary',
    },
  });

  return result.isConfirmed;
}

/**
 * Asks which file type to export. Resolves null if cancelled.
 *
 * @param subject What's being exported, e.g. "dashboard" or "report".
 */
export async function chooseExportFormat(subject: string): Promise<'pdf' | 'png' | null> {
  const result = await fireSwal({
    ...baseOptions,
    icon: 'question',
    title: t('Export {{subject}}', { subject }),
    text: t('Your sales, inventory and other key figures as a receipt-style list — as a PDF or as an image.'),
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: t('PDF receipt'),
    denyButtonText: t('Image receipt (PNG)'),
    cancelButtonText: t('Cancel'),
    customClass: {
      ...classes,
      confirmButton: 'bl-btn bl-btn--primary',
      denyButton: 'bl-btn bl-btn--secondary',
      cancelButton: 'bl-btn bl-btn--ghost',
    },
  });

  if (result.isConfirmed) return 'pdf';
  if (result.isDenied) return 'png';
  return null;
}

/** Asks whether to end the session. */
export function confirmLogout(): Promise<boolean> {
  return confirmAction({
    title: t('Log out?'),
    text: t('You will need to sign in again to get back to your business.'),
    confirmLabel: t('Log out'),
    cancelLabel: t('Stay signed in'),
  });
}

/**
 * Announces a completed write. Auto-closes shortly so entering several
 * records in a row does not turn into a click-through exercise, but stays
 * dismissible for anyone who wants to read it.
 */
export function alertSuccess(title: string, text?: string): Promise<unknown> {
  return fireSwal({
    ...baseOptions,
    icon: 'success',
    title,
    text,
    timer: 1800,
    timerProgressBar: true,
    confirmButtonText: t('Done'),
    customClass: { ...classes, confirmButton: 'bl-btn bl-btn--primary' },
  });
}

/**
 * Reports a failure that has no form to print itself into. Errors raised
 * while saving a form stay inline next to the fields instead, where they can
 * actually be corrected.
 */
export function alertError(title: string, text?: string): Promise<unknown> {
  return fireSwal({
    ...baseOptions,
    icon: 'error',
    title,
    text,
    confirmButtonText: t('Close'),
    customClass: { ...classes, confirmButton: 'bl-btn bl-btn--primary' },
  });
}

export interface PromptOptions {
  title: string;
  placeholder?: string;
  confirmLabel?: string;
}

/**
 * Asks for a single line of text — used for quick, single-field additions
 * that don't warrant a whole form (e.g. naming a new category inline from a
 * dropdown). Resolves the trimmed value, or null if cancelled.
 */
export async function promptText({
  title,
  placeholder,
  confirmLabel = t('Add'),
}: PromptOptions): Promise<string | null> {
  const result = await fireSwal({
    ...baseOptions,
    title,
    input: 'text',
    inputPlaceholder: placeholder,
    inputAttributes: { autocapitalize: 'off', autocomplete: 'off' },
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: t('Cancel'),
    inputValidator: (value: string) => (value?.trim() ? undefined : t('Enter a name.')),
    customClass: {
      ...classes,
      confirmButton: 'bl-btn bl-btn--primary',
      cancelButton: 'bl-btn bl-btn--secondary',
      input: 'bl-swal__input',
    },
  });

  if (!result.isConfirmed || typeof result.value !== 'string') return null;
  return result.value.trim();
}

export interface PromptNumberOptions {
  title: string;
  text?: string;
  placeholder?: string;
  confirmLabel?: string;
}

/**
 * Asks for a single number — used for quick, single-field numeric actions
 * that don't warrant a whole form (e.g. a stock adjustment from a list row,
 * where the full form with a notes field lives on the product detail page).
 * Resolves the number, or null if cancelled.
 */
export async function promptNumber({
  title,
  text,
  placeholder,
  confirmLabel = t('Save'),
}: PromptNumberOptions): Promise<number | null> {
  const result = await fireSwal({
    ...baseOptions,
    title,
    text,
    input: 'number',
    inputPlaceholder: placeholder,
    inputAttributes: { step: 'any' },
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: t('Cancel'),
    inputValidator: (value: string) =>
      !value || Number.isNaN(Number(value)) || Number(value) === 0
        ? t('Enter a quantity other than zero.')
        : undefined,
    customClass: {
      ...classes,
      confirmButton: 'bl-btn bl-btn--primary',
      cancelButton: 'bl-btn bl-btn--secondary',
      input: 'bl-swal__input',
    },
  });

  if (!result.isConfirmed || typeof result.value !== 'string') return null;
  return Number(result.value);
}
