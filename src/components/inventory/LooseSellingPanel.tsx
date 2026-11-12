import { createAnimation, type AnimationBuilder } from '@ionic/react';
import { useState } from 'react';
import { t } from '../../i18n';
import { fractionQty, pesoExact } from '../../utils/format';
import Button from '../common/Button';
import { CurrencyField, NumberField } from '../common/Field';
import { Modal } from '../common/Modal';
import UnitField, { singularUnit } from '../common/UnitField';
import './LooseSellingPanel.css';

export interface LooseValues {
  looseUnit: string;
  loosePerUnit: string;
  loosePrice: string;
}

/** The three settings are filled in well enough to sell loose. */
export function looseComplete(v: LooseValues): boolean {
  return v.looseUnit.trim() !== '' && Number(v.loosePerUnit) > 0 && v.loosePrice !== '' && Number(v.loosePrice) >= 0;
}

// The panel slides out from behind the Add Product window, to its right.
const slide = (direction: 'in' | 'out'): AnimationBuilder => (baseEl: HTMLElement) => {
  const wrapper = baseEl.shadowRoot?.querySelector('.modal-wrapper') ?? baseEl;
  const move = createAnimation()
    .addElement(wrapper)
    .keyframes([
      { offset: 0, opacity: '0', transform: 'translateX(-48px)' },
      { offset: 1, opacity: '1', transform: 'translateX(0)' },
    ]);
  return createAnimation()
    .addElement(baseEl)
    .easing('cubic-bezier(0.22, 1, 0.36, 1)')
    .duration(direction === 'in' ? 320 : 200)
    .direction(direction === 'in' ? 'normal' : 'reverse')
    .addAnimation(move);
};

interface LooseSellingPanelProps {
  isOpen: boolean;
  /** The product's own unit and price ("sacks", ₱2,800), for the labels and the price guide. */
  unit: string;
  sellingPrice: number;
  value: LooseValues;
  onChange: (key: keyof LooseValues, value: string) => void;
  customUnits: string[];
  /** Done with complete settings. */
  onDone: () => void;
  /** Closed without finishing (Cancel, the X, or a tap outside). */
  onCancel: () => void;
}

/**
 * "Sell loose (tingi)": a panel that opens beside the Add Product window when the
 * owner turns on loose selling, with the three settings and a price preview.
 */
export default function LooseSellingPanel({ isOpen, unit, sellingPrice, value, onChange, customUnits, onDone, onCancel }: LooseSellingPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const one = singularUnit(unit) || t('unit');
  const loose = value.looseUnit.trim();
  const perUnit = Number(value.loosePerUnit);
  const price = Number(value.loosePrice);

  const done = () => {
    if (!loose) return setError(t('Choose how this product is sold loose, for example kg or sticks.'));
    if (!(perUnit > 0)) return setError(t('Enter how many {{loose}} are in one {{unit}}.', { loose, unit: one }));
    if (value.loosePrice === '' || price < 0) return setError(t('Enter the price per {{loose}}.', { loose }));
    setError(null);
    onDone();
  };

  const cancel = () => {
    setError(null);
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={cancel}
      size="side"
      icon="product"
      title={t('Sell loose (tingi)')}
      description={t('For example a sack of rice sold by the kilo, cigarettes by the stick, or eggs by the piece.')}
      showBackdrop={false}
      enterAnimation={slide('in')}
      leaveAnimation={slide('out')}
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" onClick={done}>
            {t('Done')}
          </Button>
        </>
      }
    >
      <div className="bl-loose-panel">
        <UnitField
          label={t('Sold loose by')}
          required
          value={value.looseUnit}
          onChange={(v) => onChange('looseUnit', v)}
          customUnits={customUnits}
        />
        <NumberField
          label={t('How many in one {{unit}}', { unit: one })}
          required
          step="any"
          inputMode="decimal"
          placeholder="50"
          hint={t('e.g. 50 kg in one sack, 20 sticks in one pack')}
          value={value.loosePerUnit}
          onChange={(e) => onChange('loosePerUnit', e.target.value)}
        />
        <CurrencyField
          label={t('Price per {{unit}}', { unit: loose || t('loose unit') })}
          required
          hint={
            sellingPrice > 0 && perUnit > 0
              ? t('Selling the whole {{unit}} works out to {{price}} each.', { unit: one, price: pesoExact(sellingPrice / perUnit) })
              : undefined
          }
          value={value.loosePrice}
          onChange={(e) => onChange('loosePrice', e.target.value)}
        />

        {loose && price > 0 && (
          <div className="bl-loose-panel__preview" aria-live="polite">
            <span className="bl-loose-panel__preview-title">{t('At the counter')}</span>
            <ul>
              {[0.25, 0.5, 1].map((q) => (
                <li key={q}>
                  <span>
                    {fractionQty(q)} {loose}
                  </span>
                  <strong>{pesoExact(q * price)}</strong>
                </li>
              ))}
              {perUnit > 0 && (
                <li className="bl-loose-panel__preview-whole">
                  <span>
                    1 {one} = {fractionQty(perUnit)} {loose}
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}

        {error && (
          <p className="bl-form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
