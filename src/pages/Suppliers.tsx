import { IonIcon } from '@ionic/react';
import {
  addOutline,
  callOutline,
  locationOutline,
  mailOutline,
  peopleOutline,
  searchOutline,
} from 'ionicons/icons';
import { useMemo, useState } from 'react';
import Button from '../components/common/Button';
import { AddressPicker } from '../components/common/AddressPicker';
import { SearchInput, SelectField, TextField } from '../components/common/Field';
import { Modal } from '../components/common/Modal';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '../components/common/States';
import { Badge, CostDelta } from '../components/common/StatusBadge';
import Toolbar, { ResultCount, ToolbarFilters, ToolbarSearch } from '../components/common/Toolbar';
import PageHeader from '../components/layout/PageHeader';
import { Card } from '../components/layout/Section';
import { Bento, Workspace } from '../components/layout/Workspace';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertSuccess } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { supplierService } from '../services/api';
import type { Supplier } from '../types';
import { initialsOf, peso, shortDate } from '../utils/format';
import './Transactions.css';
import { t } from '../i18n';

const STATUS_META = {
  active: { tone: 'success', label: t('Active') },
  review: { tone: 'warning', label: t('Price review') },
  inactive: { tone: 'neutral', label: t('Inactive') },
} as const;

export function Suppliers() {
  const { activeBusiness, isManager } = useAuth();

  const { data, loading, error, reload } = useAsyncData(
    () => dataService.getSuppliers(),
    [activeBusiness?.id],
  );

  // Used to turn the supplier's product ids into names.
  const { data: products } = useAsyncData(() => dataService.getProducts(), [activeBusiness?.id]);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Supplier | null>(null);

  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);

    if (!form.name.trim()) {
      setFormError(t('Enter the supplier name.'));
      return;
    }

    if (!usesLiveData() || !activeBusiness) {
      setFormError(t('Saving needs an active business. Please sign in again.'));
      return;
    }

    if (!isManager) {
      setFormError(t('Only an owner or admin can add suppliers.'));
      return;
    }

    setSaving(true);
    try {
      const name = form.name.trim();
      await supplierService.create(activeBusiness.id, form);
      setAddOpen(false);
      setForm({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        latitude: null,
        longitude: null,
      });
      reload();
      await alertSuccess(t('Supplier added'), t('{{name}} can now be linked to products and purchases.', { name }));
    } catch (err) {
      setFormError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      const matchesQuery =
        !q || s.name.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || s.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [data, query, status]);

  const productNames = (supplier: Supplier) =>
    supplier.productIds.map((id) => (products ?? []).find((p) => p.id === id)?.name ?? id);

  const header = (
    <PageHeader
      title={t('Suppliers')}
      description={t('Who you buy from, what they supply, and how their prices are moving.')}
      actions={
        <Button variant="primary" icon={addOutline} onClick={() => setAddOpen(true)} disabled={!isManager}>
          {t('Add Supplier')}
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading suppliers')}>
          <SkeletonRows rows={5} />
        </LoadingState>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <ErrorState
          title={t('Unable to load suppliers')}
          description={t('We could not load your supplier list. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  return (
    <Workspace>
      {header}

      <Bento>
      <Card
        fill
        padding="none"
        as="h2"
        title={t('Suppliers')}
        action={
      <Toolbar>
        <ToolbarSearch>
          <SearchInput
            label={t('Search suppliers by name or contact person')}
            placeholder={t('Search suppliers')}
            value={query}
            onValueChange={setQuery}
          />
        </ToolbarSearch>
        <ToolbarFilters>
          <SelectField
            label={t('Filter by status')}
            hideLabel
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'all', label: t('All statuses') },
              { value: 'active', label: t('Active') },
              { value: 'review', label: t('Price review') },
              { value: 'inactive', label: t('Inactive') },
            ]}
          />
        </ToolbarFilters>
      </Toolbar>
        }
      >
      <ResultCount shown={filtered.length} total={data.length} noun="suppliers" />

      {filtered.length === 0 ? (
        <EmptyState
          icon={data.length === 0 ? peopleOutline : searchOutline}
          title={data.length === 0 ? t('No suppliers yet') : t('No suppliers match your search')}
          description={
            data.length === 0
              ? t('Use the button above to add your first supplier and track prices and delivery reliability.') : t('Try a different name, contact person or status.')
          }
          actionLabel={data.length === 0 ? undefined : t('Clear filters')}
          onAction={
            data.length === 0
              ? undefined
              : () => {
                  setQuery('');
                  setStatus('all');
                }
          }
          compact={data.length > 0}
        />
      ) : (
        <>
          <div className="bl-responsive-table">
            <Card padding="none">
              <div className="bl-table-wrap bl-scroll">
                <table className="bl-table bl-table--clickable">
                  <caption className="bl-sr-only">
                    {t('Suppliers with contact details, products supplied and price trend')}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('Supplier')}</th>
                      <th scope="col" className="bl-tx__col-secondary">
                        {t('Contact')}
                      </th>
                      <th scope="col">{t('Products supplied')}</th>
                      <th scope="col" className="bl-td-num">
                        {t('Average price')}
                      </th>
                      <th scope="col">{t('Price trend')}</th>
                      <th scope="col">{t('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((supplier) => (
                      <tr key={supplier.id} onClick={() => setDetail(supplier)}>
                        <td>
                          <div className="bl-sup__namecell">
                            <span className="bl-sup__initials" aria-hidden="true">
                              {initialsOf(supplier.name)}
                            </span>
                            <div>
                              <div className="bl-table__primary">{supplier.name}</div>
                              <div className="bl-table__sub">{supplier.address}</div>
                            </div>
                          </div>
                        </td>
                        <td className="bl-tx__col-secondary">
                          <div className="bl-sup__contact">
                            <span>{supplier.contactPerson}</span>
                            <span className="bl-table__sub">{supplier.phone}</span>
                          </div>
                        </td>
                        <td>
                          <div className="bl-sup__products">
                            {productNames(supplier).map((name) => (
                              <Badge tone="neutral" key={name}>
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="bl-td-num">{peso(supplier.averageUnitPrice)}</td>
                        <td>
                          <CostDelta pct={supplier.priceChangePct} label={t('in supplier price')} />
                        </td>
                        <td>
                          <Badge tone={STATUS_META[supplier.status].tone}>
                            {STATUS_META[supplier.status].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <ul className="bl-responsive-cards">
            {filtered.map((supplier) => (
              <li key={supplier.id}>
                <button type="button" className="bl-drow bl-card--interactive" onClick={() => setDetail(supplier)}>
                  <div className="bl-drow__top">
                    <div className="bl-sup__namecell">
                      <span className="bl-sup__initials" aria-hidden="true">
                        {initialsOf(supplier.name)}
                      </span>
                      <div>
                        <span className="bl-drow__title">{supplier.name}</span>
                        <span className="bl-drow__meta">{supplier.contactPerson}</span>
                      </div>
                    </div>
                    <Badge tone={STATUS_META[supplier.status].tone}>
                      {STATUS_META[supplier.status].label}
                    </Badge>
                  </div>

                  <div className="bl-sup__products">
                    {productNames(supplier).map((name) => (
                      <Badge tone="neutral" key={name}>
                        {name}
                      </Badge>
                    ))}
                  </div>

                  <dl className="bl-drow__grid">
                    <div className="bl-drow__cell">
                      <dt>{t('Average price')}</dt>
                      <dd>{peso(supplier.averageUnitPrice)}</dd>
                    </div>
                    <div className="bl-drow__cell">
                      <dt>{t('Price trend')}</dt>
                      <dd>
                        <CostDelta pct={supplier.priceChangePct} label={t('in supplier price')} />
                      </dd>
                    </div>
                  </dl>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      </Card>
      </Bento>

      {/* ---- Supplier detail ---------------------------------------------- */}
      <Modal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? t('Supplier')}
        icon="supplier"
        description={detail ? STATUS_META[detail.status].label : undefined}
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            {t('Close')}
          </Button>
        }
      >
        {detail && (
          <div className="bl-stack bl-stack--lg">
            <ul className="bl-sup__detaillist">
              <li>
                <IonIcon icon={peopleOutline} aria-hidden="true" />
                <span>
                  <span className="bl-caption">{t('Contact person')}</span>
                  {detail.contactPerson}
                </span>
              </li>
              <li>
                <IonIcon icon={callOutline} aria-hidden="true" />
                <span>
                  <span className="bl-caption">{t('Phone')}</span>
                  {detail.phone}
                </span>
              </li>
              <li>
                <IonIcon icon={mailOutline} aria-hidden="true" />
                <span>
                  <span className="bl-caption">{t('Email')}</span>
                  {detail.email}
                </span>
              </li>
              <li>
                <IonIcon icon={locationOutline} aria-hidden="true" />
                <span>
                  <span className="bl-caption">{t('Address')}</span>
                  {detail.address}
                  {detail.latitude !== null && detail.longitude !== null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${detail.latitude}&mlon=${detail.longitude}#map=17/${detail.latitude}/${detail.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('View on map')}
                    </a>
                  )}
                </span>
              </li>
            </ul>

            <div>
              <h3 className="bl-card-title">{t('Products supplied')}</h3>
              <div className="bl-sup__products bl-sup__products--modal">
                {productNames(detail).map((name) => (
                  <Badge tone="brand" key={name}>
                    {name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="bl-kv">
              <div className="bl-kv__item">
                <span className="bl-kv__k">{t('Average unit price')}</span>
                <span className="bl-kv__v">{peso(detail.averageUnitPrice)}</span>
              </div>
              <div className="bl-kv__item">
                <span className="bl-kv__k">{t('Price change (3 months)')}</span>
                <span className="bl-kv__v">
                  <CostDelta pct={detail.priceChangePct} />
                </span>
              </div>
              <div className="bl-kv__item">
                <span className="bl-kv__k">{t('Reliability score')}</span>
                <span className="bl-kv__v">{detail.reliabilityScore}%</span>
              </div>
              <div className="bl-kv__item">
                <span className="bl-kv__k">{t('Last ordered')}</span>
                <span className="bl-kv__v">{shortDate(detail.lastOrderedAt)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- Add supplier -------------------------------------------------- */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('Add Supplier')}
        icon="supplier"
        description={t('Record a supplier so their prices can be tracked over time.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              {saving ? t('Saving') : t('Save Supplier')}
            </Button>
          </>
        }
      >
        <form
          className="bl-form-grid bl-form-grid--2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          {formError && (
            <p className="bl-form-error bl-form-grid__full" role="alert">
              {formError}
            </p>
          )}

          <TextField
            label={t('Supplier name')}
            placeholder={t('e.g. Golden Harvest Trading')}
            required
            textOnly
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextField
            label={t('Contact person')}
            placeholder={t('Full name')}
            textOnly
            value={form.contactPerson}
            onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
          />
          <TextField
            label={t('Phone')}
            type="tel"
            inputMode="tel"
            placeholder={t('+63 9XX XXX XXXX')}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextField
            label={t('Email')}
            type="email"
            inputMode="email"
            placeholder={t('orders@supplier.ph')}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <AddressPicker
            label={t('Address')}
            className="bl-form-grid__full"
            value={{ address: form.address, lat: form.latitude, lng: form.longitude }}
            onChange={(v) =>
              setForm((f) => ({ ...f, address: v.address, latitude: v.lat, longitude: v.lng }))
            }
          />
        </form>
      </Modal>
    </Workspace>
  );
}

export default Suppliers;
