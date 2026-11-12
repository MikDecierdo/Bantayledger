import { IonIcon } from '@ionic/react';
import { downloadOutline, printOutline } from 'ionicons/icons';
import { useState } from 'react';
import Button from '../common/Button';
import { Modal } from '../common/Modal';
import { isInstalledApp } from '../../lib/platform';
import { php, qty, ReceiptBuilder, saveReceipt } from '../../lib/receipt';
import { intlLocale, t } from '../../i18n';
import { fractionQty } from '../../utils/format';
import type { Sale } from '../../types';
import './SaleReceipt.css';

/** Everything printed on the receipt, captured the moment the sale was saved. */
export interface ReceiptData {
  receiptNo: string;
  /** Saved on this phone, waiting for internet. */
  queued: boolean;
  store: { name: string; address?: string | null; phone?: string | null };
  cashier: string;
  at: Date;
  /** A loose line (`loose`) is in loose units: 0.5 kg at the price per kg. */
  lines: { name: string; quantity: number; unit: string; unitPrice: number; loose?: boolean }[];
  total: number;
  payment: {
    mode: 'Cash' | 'GCash' | 'Split';
    cashPart: number;
    gcashPart: number;
    /** What the customer handed over in cash, when it was entered. */
    cashReceived: number | null;
    change: number | null;
    reference?: string;
  };
}

/** Always with centavos, like a cashier's receipt: ₱25.00 */
/**
 * A receipt for a sale already saved (Activity log). The cash handed over and the
 * change were never stored, so those two lines are left out.
 */
export function receiptFromSale(sale: Sale, store: ReceiptData['store']): ReceiptData {
  const cash = sale.payments.find((p) => p.method === 'Cash');
  const gcash = sale.payments.find((p) => p.method === 'GCash');
  const mode: ReceiptData['payment']['mode'] = cash && gcash ? 'Split' : gcash || sale.paymentMethod === 'GCash' ? 'GCash' : 'Cash';
  return {
    receiptNo: sale.id.replace(/-/g, '').slice(0, 10).toUpperCase(),
    queued: false,
    store,
    cashier: sale.cashier,
    at: sale.createdAt ? new Date(sale.createdAt) : new Date(`${sale.date}T12:00:00`),
    lines: sale.items.map((i) =>
      i.looseQuantity
        ? { name: i.productName, quantity: i.looseQuantity, unit: i.looseUnit ?? '', unitPrice: i.loosePrice ?? 0, loose: true }
        : { name: i.productName, quantity: i.quantity, unit: '', unitPrice: i.unitPrice },
    ),
    total: sale.total,
    payment: {
      mode,
      cashPart: cash?.amount ?? (mode === 'Cash' ? sale.total : 0),
      gcashPart: gcash?.amount ?? (mode === 'GCash' ? sale.total : 0),
      cashReceived: null,
      change: null,
      reference: (gcash?.reference ?? sale.paymentReference) || undefined,
    },
  };
}

const money = (v: number) => `₱${v.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const timeText = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
// A loose line (½ kg) counts as one item.
const itemCount = (data: ReceiptData) => data.lines.reduce((n, l) => n + (l.loose ? 1 : l.quantity), 0);
/** "2" for whole items, "½ kg" for loose ones. */
const lineQty = (l: ReceiptData['lines'][number]) => (l.loose ? `${fractionQty(l.quantity)} ${l.unit}` : fractionQty(l.quantity));

/** The same receipt as monospaced lines, for the downloadable picture. */
function receiptLines(data: ReceiptData) {
  const r = new ReceiptBuilder();
  r.center(data.store.name, true);
  if (data.store.address) r.center(data.store.address);
  if (data.store.phone) r.center(data.store.phone);
  r.blank().center(t('SALES RECEIPT'), true).rule();
  r.row(t('Date'), `${dateText(data.at)} ${timeText(data.at)}`);
  r.row(t('Receipt No.'), data.receiptNo);
  r.row(t('Cashier'), data.cashier);
  r.rule();
  for (const l of data.lines) {
    r.text(l.name);
    r.row(`${lineQty(l)} x ${php(l.unitPrice)}`, php(l.unitPrice * l.quantity), { indent: 2 });
  }
  r.rule();
  r.row(t('Items'), qty(itemCount(data)));
  r.row(t('TOTAL'), php(data.total), { bold: true });
  r.rule();
  const p = data.payment;
  if (p.mode !== 'GCash') {
    r.row(p.mode === 'Split' ? t('Cash part') : t('Cash'), php(p.cashReceived ?? p.cashPart));
  }
  if (p.mode !== 'Cash') {
    r.row('GCash', php(p.mode === 'GCash' ? data.total : p.gcashPart));
    if (p.reference) r.row(t('GCash ref.'), `****${p.reference}`, { indent: 2 });
  }
  if (p.change !== null) r.row(t('CHANGE'), php(p.change), { bold: true });
  r.rule('double');
  if (data.queued) r.center(t('Saved on this phone. It will be sent when you are back online.'));
  r.center(t('Thank you, come again!'), true).center(t('This is not an official receipt.')).center('BantayLedger AI').blank();
  return r.lines;
}

/** A thin-and-thick bar pattern made from the receipt number (decoration only). */
function Barcode({ value }: { value: string }) {
  const bars: number[] = [];
  for (const ch of value) {
    const c = ch.charCodeAt(0);
    bars.push(1 + (c % 3), 1, 1 + ((c >> 2) % 2), 1);
  }
  let x = 0;
  const rects = bars.map((w, i) => {
    const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={34} /> : null;
    x += w;
    return rect;
  });
  return (
    <svg className="bl-receipt__barcode" viewBox={`0 0 ${x} 34`} preserveAspectRatio="none" aria-hidden="true">
      {rects}
    </svg>
  );
}

/** `copy`: reopening the receipt of an earlier sale (Activity log), not one just saved. */
export default function SaleReceipt({ data, onClose, copy = false }: { data: ReceiptData | null; onClose: () => void; copy?: boolean }) {
  const [saving, setSaving] = useState(false);
  const canPrint = !isInstalledApp();

  const saveImage = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await saveReceipt(receiptLines(data), `receipt-${data.receiptNo}`, 'png');
    } finally {
      setSaving(false);
    }
  };

  const p = data?.payment;
  return (
    <Modal
      isOpen={data !== null}
      onClose={onClose}
      title={copy ? t('Receipt') : data?.queued ? t('Saved on this phone') : t('Sale recorded')}
      description={copy ? t('A copy of the receipt for this sale.') : data?.queued ? t('There is no internet right now. It will be sent automatically when you are back online.') : t('Stock has been updated to match.')}
      icon="sale"
      size="md"
      footer={
        <div className="bl-receipt__actions">
          {canPrint && (
            <Button variant="ghost" icon={printOutline} onClick={() => window.print()}>
              {t('Print')}
            </Button>
          )}
          <Button variant="secondary" icon={downloadOutline} onClick={() => void saveImage()} disabled={saving}>
            {t('Save image')}
          </Button>
          <Button variant="primary" onClick={onClose}>{t('Done')}</Button>
        </div>
      }
    >
      {data && p && (
        <div className="bl-receipt-wrap">
          <article className="bl-receipt" aria-label={t('Receipt')}>
            <header className="bl-receipt__head">
              <p className="bl-receipt__store">{data.store.name}</p>
              {data.store.address && <p>{data.store.address}</p>}
              {data.store.phone && <p>{data.store.phone}</p>}
              <p className="bl-receipt__kind">{t('SALES RECEIPT')}</p>
            </header>
            <hr />
            <dl className="bl-receipt__meta">
              <div><dt>{t('Date')}</dt><dd>{dateText(data.at)} {timeText(data.at)}</dd></div>
              <div><dt>{t('Receipt No.')}</dt><dd>{data.receiptNo}</dd></div>
              <div><dt>{t('Cashier')}</dt><dd>{data.cashier}</dd></div>
            </dl>
            <hr />
            <ul className="bl-receipt__items">
              {data.lines.map((l, i) => (
                <li key={i}>
                  <span className="bl-receipt__name">{l.name}</span>
                  <span className="bl-receipt__row">
                    <span>{lineQty(l)} x {money(l.unitPrice)}</span>
                    <span>{money(l.unitPrice * l.quantity)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <hr />
            <div className="bl-receipt__row"><span>{t('Items')}</span><span>{qty(itemCount(data))}</span></div>
            <div className="bl-receipt__row bl-receipt__total"><span>{t('TOTAL')}</span><span>{money(data.total)}</span></div>
            <hr />
            {p.mode !== 'GCash' && (
              <div className="bl-receipt__row"><span>{p.mode === 'Split' ? t('Cash part') : t('Cash')}</span><span>{money(p.cashReceived ?? p.cashPart)}</span></div>
            )}
            {p.mode !== 'Cash' && (
              <>
                <div className="bl-receipt__row"><span>GCash</span><span>{money(p.mode === 'GCash' ? data.total : p.gcashPart)}</span></div>
                {p.reference && <div className="bl-receipt__row bl-receipt__sub"><span>{t('GCash ref.')}</span><span>****{p.reference}</span></div>}
              </>
            )}
            {p.change !== null && (
              <div className="bl-receipt__row bl-receipt__total"><span>{t('CHANGE')}</span><span>{money(p.change)}</span></div>
            )}
            <hr className="bl-receipt__double" />
            {data.queued && <p className="bl-receipt__note">{t('Saved on this phone. It will be sent when you are back online.')}</p>}
            <footer className="bl-receipt__foot">
              <p className="bl-receipt__thanks">{t('Thank you, come again!')}</p>
              <Barcode value={data.receiptNo} />
              <p className="bl-receipt__no">{data.receiptNo}</p>
              <p>{t('This is not an official receipt.')}</p>
              <p className="bl-receipt__brand">
                <IonIcon icon={printOutline} aria-hidden="true" /> BantayLedger AI
              </p>
            </footer>
          </article>
        </div>
      )}
    </Modal>
  );
}
