import { IonIcon } from '@ionic/react';
import { alertCircleOutline, searchOutline } from 'ionicons/icons';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { t } from '../../i18n';

interface BaseFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Shows a quiet "(optional)" after the label. */
  optional?: boolean;
  /** Hide the visible label but keep it for screen readers. */
  hideLabel?: boolean;
  className?: string;
}

function FieldShell({
  label,
  hint,
  error,
  required,
  optional,
  hideLabel,
  className,
  id,
  children,
}: BaseFieldProps & { id: string; children: ReactNode }) {
  return (
    <div
      className={['bl-field', error ? 'bl-field--invalid' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <label className={hideLabel ? 'bl-sr-only' : 'bl-field__label'} htmlFor={id}>
        {label}
        {required && (
          <span className="bl-field__req" aria-hidden="true">
            *
          </span>
        )}
        {optional && !required && <span className="bl-field__opt"> ({t('optional')})</span>}
      </label>
      {children}
      {hint && !error && (
        <span className="bl-field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="bl-field__error" id={`${id}-error`}>
          <IonIcon icon={alertCircleOutline} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type TextFieldProps = BaseFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> & {
    /** Leading affix, e.g. "₱" for money inputs. */
    prefix?: string;
    /** When true, only letters and spaces are allowed — digits are blocked. */
    textOnly?: boolean;
  };

export function TextField({
  label,
  hint,
  error,
  required,
  optional,
  hideLabel,
  className,
  prefix,
  textOnly,
  onKeyDown,
  onPaste,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (textOnly && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
    onKeyDown?.(e);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    if (textOnly) {
      const pasted = e.clipboardData.getData('text');
      if (/[0-9]/.test(pasted)) {
        e.preventDefault();
        const cleaned = pasted.replace(/[0-9]/g, '');
        const target = e.target as HTMLInputElement;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const next = target.value.slice(0, start) + cleaned + target.value.slice(end);
        target.value = next;
        target.setSelectionRange(start + cleaned.length, start + cleaned.length);
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    onPaste?.(e);
  };

  const input = (
    <input
      id={id}
      className="bl-input"
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      required={required}
      inputMode={textOnly ? 'text' : rest.inputMode}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      {...rest}
    />
  );

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      hideLabel={hideLabel}
      className={className}
      id={id}
    >
      {prefix ? (
        <span className="bl-input-group">
          <span className="bl-input-group__affix" aria-hidden="true">
            {prefix}
          </span>
          {input}
        </span>
      ) : (
        input
      )}
    </FieldShell>
  );
}

/** Peso amount input: numeric keypad on mobile, ₱ affix, decimal step. */
export function CurrencyField(props: Omit<TextFieldProps, 'prefix' | 'type'>) {
  return (
    <TextField
      {...props}
      prefix="₱"
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      placeholder={props.placeholder ?? '0.00'}
    />
  );
}

export function NumberField(props: Omit<TextFieldProps, 'type'>) {
  // `min={0}` first, `...props` after: quantities default to non-negative
  // (every existing caller relies on this), but a caller that genuinely
  // needs signed values (e.g. a stock adjustment, positive to add / negative
  // to remove) can override it by passing its own `min`.
  return <TextField min={0} {...props} type="number" inputMode="numeric" />;
}

export function DateField(props: Omit<TextFieldProps, 'type' | 'prefix'>) {
  return <TextField {...props} type="date" />;
}

/* -------------------------------------------------------------------------- */

type SelectFieldProps = BaseFieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> & {
    options: { value: string; label: string }[];
    placeholder?: string;
  };

export function SelectField({
  label,
  hint,
  error,
  required,
  hideLabel,
  className,
  options,
  placeholder,
  ...rest
}: SelectFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      className={className}
      id={id}
    >
      <select
        id={id}
        className="bl-select"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/* -------------------------------------------------------------------------- */

type TextAreaFieldProps = BaseFieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> & {
    /** When true, only letters and spaces are allowed — digits are blocked. */
    textOnly?: boolean;
  };

export function TextAreaField({
  label,
  hint,
  error,
  required,
  hideLabel,
  className,
  textOnly,
  onKeyDown,
  onPaste,
  ...rest
}: TextAreaFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (textOnly && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
    onKeyDown?.(e);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (textOnly) {
      const pasted = e.clipboardData.getData('text');
      if (/[0-9]/.test(pasted)) {
        e.preventDefault();
        const cleaned = pasted.replace(/[0-9]/g, '');
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const next = target.value.slice(0, start) + cleaned + target.value.slice(end);
        target.value = next;
        target.setSelectionRange(start + cleaned.length, start + cleaned.length);
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    onPaste?.(e);
  };

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      className={className}
      id={id}
    >
      <textarea
        id={id}
        className="bl-textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        rows={3}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        {...rest}
      />
    </FieldShell>
  );
}

/* -------------------------------------------------------------------------- */

interface SearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}

export function SearchInput({
  value,
  onValueChange,
  placeholder = t('Search'),
  label,
  className,
}: SearchInputProps) {
  const id = useId();
  return (
    <div className={['bl-field', className ?? ''].filter(Boolean).join(' ')}>
      <label className="bl-sr-only" htmlFor={id}>
        {label}
      </label>
      <span className="bl-input-group">
        <span className="bl-input-group__affix" aria-hidden="true">
          <IonIcon icon={searchOutline} />
        </span>
        <input
          id={id}
          type="search"
          className="bl-input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <span className="bl-switch">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="bl-switch__track" aria-hidden="true">
        <span className="bl-switch__thumb" />
      </span>
    </span>
  );
}
