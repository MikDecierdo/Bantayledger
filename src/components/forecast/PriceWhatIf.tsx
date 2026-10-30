import { useMemo, useState } from 'react';
import { NumberField } from '../common/Field';
import { Badge } from '../common/StatusBadge';
import { Card } from '../layout/Section';
import { useAsyncData } from '../../hooks/useAsyncData';
import { dataService } from '../../services/dataService';
import type { DemandForecast, Product } from '../../types';
import { peso } from '../../utils/format';
import './PriceWhatIf.css';
import { t } from '../../i18n';

const PRESETS = [-10, 5, 10, 20, 30];
/** A margin under this after the change is flagged as thin. */
const THIN_MARGIN_PCT = 10;
const DAYS_IN_MONTH = 30;

interface Row {
  product: Product;
  newCost: number;
  marginNow: number;
  marginAfter: number;
  /** Selling price that keeps today's margin % at the new cost. */
  keepMarginPrice: number;
  /** Extra (or lower) purchasing spend per month at the forecast pace. */
  monthlyDelta: number;
}

const marginPct = (sell: number, cost: number) => (sell > 0 ? ((sell - cost) / sell) * 100 : -100);

/**
 * "What if my supplier raises (or cuts) prices by X%?" — worked out in the
 * browser from current costs and the demand forecast, so it can be tried with
 * any number without touching the data.
 */
export function PriceWhatIf({ demand }: { demand: DemandForecast[] }) {
  const [change, setChange] = useState('10');
  const { data: products } = useAsyncData(() => dataService.getProducts(), []);

  const pct = Number(change);
  const valid = change.trim() !== '' && Number.isFinite(pct) && pct >= -90 && pct <= 300;

  const rows = useMemo<Row[]>(() => {
    if (!valid || !products) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    const out: Row[] = [];
    for (const d of demand) {
      const product = byId.get(d.productId);
      if (!product || !product.isActive || product.costPrice <= 0) continue;
      const newCost = product.costPrice * (1 + pct / 100);
      const marginNow = marginPct(product.sellingPrice, product.costPrice);
      const marginAfter = marginPct(product.sellingPrice, newCost);
      const keepMarginPrice = marginNow < 100 ? newCost / (1 - marginNow / 100) : newCost;
      out.push({
        product,
        newCost,
        marginNow,
        marginAfter,
        keepMarginPrice,
        monthlyDelta: d.averageDailyDemand * DAYS_IN_MONTH * (newCost - product.costPrice),
      });
    }
    // Biggest impact on spending first.
    return out.sort((a, b) => Math.abs(b.monthlyDelta) - Math.abs(a.monthlyDelta));
  }, [demand, products, pct, valid]);

  const totalDelta = rows.reduce((sum, r) => sum + r.monthlyDelta, 0);
  const squeezed = rows.filter((r) => r.marginAfter < THIN_MARGIN_PCT).length;

  return (
    <Card>
      <div className="bl-whatif__controls">
        <NumberField
          label={t('Supplier price change (%)')}
          min={-90}
          max={300}
          step="1"
          value={change}
          onChange={(e) => setChange(e.target.value)}
          error={valid || change.trim() === '' ? undefined : t('Enter a change between -90% and 300%.')}
        />
        <div className="bl-whatif__chips" role="group" aria-label={t('Quick price changes')}>
          {PRESETS.map((p) => (
            <button key={p} type="button" className="bl-whatif__chip" onClick={() => setChange(String(p))}>
              {p > 0 ? '+' : ''}
              {p}%
            </button>
          ))}
        </div>
      </div>

      {demand.length === 0 || !valid ? (
        <p className="bl-support">
          {demand.length === 0
            ? t('Once forecasts exist for your products, you can test a supplier price change here.')
            : t('Enter a price change to see its effect.')}
        </p>
      ) : (
        <>
          <div className="bl-whatif__totals" aria-live="polite">
            <div>
              <span className="bl-label">{t('Purchasing per month')}</span>
              <p className={`bl-whatif__total ${totalDelta > 0 ? 'is-up' : 'is-down'}`}>
                {totalDelta >= 0 ? '+' : '−'}
                {peso(Math.abs(totalDelta))}
              </p>
            </div>
            <p className="bl-caption">
              {squeezed === 0
                ? t('No product falls below a {{pct}}% profit.', { pct: THIN_MARGIN_PCT })
                : squeezed === 1
                  ? t('1 product would fall below a {{pct}}% profit.', { pct: THIN_MARGIN_PCT })
                  : t('{{count}} products would fall below a {{pct}}% profit.', { count: squeezed, pct: THIN_MARGIN_PCT })}
            </p>
          </div>

          <div className="bl-table-wrap bl-scroll">
            <table className="bl-table">
              <caption className="bl-sr-only">{t('Effect of a supplier price change on each product')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('Product')}</th>
                  <th scope="col" className="bl-td-num">{t('Buying price')}</th>
                  <th scope="col" className="bl-td-num">{t('Selling price')}</th>
                  <th scope="col" className="bl-td-num">{t('Profit')}</th>
                  <th scope="col" className="bl-td-num">{t('To keep your profit')}</th>
                  <th scope="col" className="bl-td-num">{t('Per month')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product.id}>
                    <td className="bl-table__primary">{r.product.name}</td>
                    <td className="bl-td-num">
                      {peso(r.product.costPrice)} → {peso(r.newCost)}
                    </td>
                    <td className="bl-td-num">{peso(r.product.sellingPrice)}</td>
                    <td className="bl-td-num">
                      {r.marginNow.toFixed(0)}% → {r.marginAfter.toFixed(0)}%{' '}
                      {r.marginAfter < 0 ? (
                        <Badge tone="danger">{t('Loss')}</Badge>
                      ) : r.marginAfter < THIN_MARGIN_PCT ? (
                        <Badge tone="warning">{t('Thin')}</Badge>
                      ) : null}
                    </td>
                    <td className="bl-td-num">{peso(Math.ceil(r.keepMarginPrice))}</td>
                    <td className="bl-td-num">
                      {r.monthlyDelta >= 0 ? '+' : '−'}
                      {peso(Math.abs(r.monthlyDelta))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

export default PriceWhatIf;
