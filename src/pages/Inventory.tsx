import {
  addOutline,
  cameraOutline,
  createOutline,
  cubeOutline,
  searchOutline,
  swapVerticalOutline,
  powerOutline,
  trashOutline,
} from 'ionicons/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import Button from '../components/common/Button';
import { CurrencyField, NumberField, SearchInput, SelectField, TextField } from '../components/common/Field';
import { Modal } from '../components/common/Modal';
import ProductThumbnail from '../components/common/ProductThumbnail';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '../components/common/States';
import { Badge, StatusBadge } from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import Toolbar, {
  ChipFilter,
  ResultCount,
  ToolbarFilters,
  ToolbarSearch,
} from '../components/common/Toolbar';
import PageHeader from '../components/layout/PageHeader';
import { Card } from '../components/layout/Section';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertError, alertSuccess, confirmAction, promptNumber, promptText } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { categoryService, productService } from '../services/api';
import type { Product, StockStatus } from '../types';
import { number, peso } from '../utils/format';
import './Inventory.css';
import { t } from '../i18n';

type StatusFilter = 'all' | StockStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: t('All') },
  { value: 'critical', label: t('Almost out') },
  { value: 'low', label: t('Low Stock') },
  { value: 'out', label: t('Out of Stock') },
  { value: 'healthy', label: t('Enough') },
];

/** Sentinel value for the category dropdown's inline "add new" row. */
const NEW_CATEGORY_OPTION = '__new_category__';

/** Empty state for the Add Product form. */
const BLANK_FORM = {
  name: '',
  sku: '',
  categoryId: '',
  supplierId: '',
  unit: '',
  openingStock: '',
  minimumStock: '',
  reorderQuantity: '',
  costPrice: '',
  sellingPrice: '',
};

/**
 * A "size" / sub-unit (e.g. "Coke 500ml" alongside "Coke 1 Liter") is a
 * fully independent product in its own right — its own stock, price,
 * category, supplier and photo — linked to the main product only by
 * `variantGroupId` for display grouping. `localId` is a client-only key for
 * the add/remove list, since these don't have a server id until saved.
 */
interface SubUnitForm {
  localId: string;
  name: string;
  sku: string;
  categoryId: string;
  supplierId: string;
  unit: string;
  openingStock: string;
  minimumStock: string;
  reorderQuantity: string;
  costPrice: string;
  sellingPrice: string;
  imageFile: File | null;
  imagePreviewUrl: string | null;
}

let subUnitKeySeq = 0;
const blankSubUnit = (): SubUnitForm => ({
  localId: `new-${++subUnitKeySeq}`,
  name: '',
  sku: '',
  categoryId: '',
  supplierId: '',
  unit: '',
  openingStock: '',
  minimumStock: '',
  reorderQuantity: '',
  costPrice: '',
  sellingPrice: '',
  imageFile: null,
  imagePreviewUrl: null,
});

export function Inventory() {
  const history = useHistory();
  const location = useLocation<{ editProductId?: string } | undefined>();
  const { showToast } = useToast();
  const { activeBusiness, isManager } = useAuth();
  const { data, loading, error, reload } = useAsyncData(
    () => dataService.getProducts(),
    [activeBusiness?.id],
  );

  // Reference data for the form's dropdowns. Only meaningful when connected.
  const { data: suppliers } = useAsyncData(() => dataService.getSuppliers(), [activeBusiness?.id]);
  const { data: dbCategories, reload: reloadCategories } = useAsyncData(
    () => (usesLiveData() && activeBusiness ? categoryService.list(activeBusiness.id) : Promise.resolve([])),
    [activeBusiness?.id],
  );

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  /** null = the form is adding a new product; set = it's editing this one instead.
   *  Also gets set mid-save if a brand-new product saves successfully but one
   *  of its sizes doesn't — so a retry updates the now-real product instead
   *  of trying to create it a second time. */
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  /** The group this product's sizes should anchor to — the product's own
   *  `variantGroupId` if it's already a sibling, so a new size added from a
   *  sibling's edit screen still links to the original anchor. */
  const [editingVariantGroupId, setEditingVariantGroupId] = useState<string | null>(null);

  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Photo state is separate from `form` — it's a File/upload concern, not a
  // text field, and the product itself saves successfully even if the photo
  // step below fails.
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Additional sizes ("Coke 500ml" alongside "Coke 1 Liter") being added in
  // this same modal visit — each is a full, independent product saved right
  // after the main one, linked only by variantGroupId.
  const [subUnits, setSubUnits] = useState<SubUnitForm[]>([]);

  const setField = (key: keyof typeof BLANK_FORM) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const resetImageState = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setExistingImageUrl(null);
    setImageFile(null);
    setImagePreviewUrl(null);
    setRemoveExistingImage(false);
  };

  const resetSubUnits = () => {
    setSubUnits((units) => {
      units.forEach((u) => {
        if (u.imagePreviewUrl) URL.revokeObjectURL(u.imagePreviewUrl);
      });
      return [];
    });
  };

  const addSubUnit = () => setSubUnits((units) => [...units, blankSubUnit()]);

  const removeSubUnit = (localId: string) => {
    setSubUnits((units) => {
      const target = units.find((u) => u.localId === localId);
      if (target?.imagePreviewUrl) URL.revokeObjectURL(target.imagePreviewUrl);
      return units.filter((u) => u.localId !== localId);
    });
  };

  const updateSubUnit = (localId: string, patch: Partial<SubUnitForm>) =>
    setSubUnits((units) => units.map((u) => (u.localId === localId ? { ...u, ...patch } : u)));

  const handleSubUnitPhotoChange = (localId: string, file: File | null) =>
    setSubUnits((units) =>
      units.map((u) => {
        if (u.localId !== localId) return u;
        if (u.imagePreviewUrl) URL.revokeObjectURL(u.imagePreviewUrl);
        return { ...u, imageFile: file, imagePreviewUrl: file ? URL.createObjectURL(file) : null };
      }),
    );

  const closeModal = () => {
    setAddOpen(false);
    setEditingProductId(null);
    setEditingVariantGroupId(null);
    setForm(BLANK_FORM);
    resetImageState();
    resetSubUnits();
  };

  const openEditModal = (product: Product) => {
    // The domain type carries the category's name, but the form's dropdown
    // is keyed by id — look the id up from the live category list.
    const category = (dbCategories ?? []).find((c) => c.name === product.category);

    setEditingProductId(product.id);
    setEditingVariantGroupId(product.variantGroupId);
    setForm({
      name: product.name,
      sku: product.sku,
      categoryId: category?.id ?? '',
      supplierId: product.supplierId,
      unit: product.unit,
      // Stock only ever changes through the ledger (a sale, a purchase, a
      // waste record, or an adjustment) — editing never touches it directly.
      openingStock: '',
      minimumStock: String(product.minimumStock),
      reorderQuantity: String(product.reorderQuantity),
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
    });
    setFormError(null);
    resetImageState();
    resetSubUnits();
    setExistingImageUrl(product.imageUrl);
    setAddOpen(true);
  };

  const handlePhotoChange = (file: File | null) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
    setRemoveExistingImage(false);
  };

  const handleRemovePhoto = () => {
    if (imageFile) {
      handlePhotoChange(null);
      return;
    }
    setRemoveExistingImage(true);
  };

  /** Uploads/removes the pending photo after the product itself has saved. A
   *  failure here doesn't undo the save — the product record is already
   *  correct, so this only ever surfaces as a secondary toast. */
  const syncPhoto = async (businessId: string, productId: string) => {
    try {
      if (imageFile) {
        await productService.uploadImage(businessId, productId, imageFile);
      } else if (removeExistingImage) {
        await productService.removeImage(businessId, productId);
      }
    } catch {
      showToast(t('Product saved, but the photo could not be uploaded.'), 'info');
    }
  };

  const photoPreview = imageFile ? imagePreviewUrl : removeExistingImage ? null : existingImageUrl;

  // Lets ProductDetails' Edit button open this same form pre-filled, by
  // navigating here with the product id in router state rather than
  // duplicating the whole form on that page too.
  useEffect(() => {
    const targetId = location.state?.editProductId;
    if (!targetId || !data) return;

    const product = data.find((p) => p.id === targetId);
    if (product) openEditModal(product);

    history.replace({ pathname: location.pathname, state: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, data]);

  const categories = useMemo(
    () => Array.from(new Set((data ?? []).map((p) => p.category))),
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      const matchesQuery =
        !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || p.status === status;
      const matchesCategory = category === 'all' || p.category === category;
      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [data, query, status, category]);

  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      all: list.length,
      critical: list.filter((p) => p.status === 'critical').length,
      low: list.filter((p) => p.status === 'low').length,
      out: list.filter((p) => p.status === 'out').length,
      healthy: list.filter((p) => p.status === 'healthy').length,
    };
  }, [data]);

  const supplierName = (id: string) =>
    (suppliers ?? []).find((s) => s.id === id)?.name ?? t('Unassigned');

  // Every product in a size group resolves to the same key — the anchor's
  // own id — whether it's the anchor itself (variantGroupId null) or one of
  // its siblings (variantGroupId = anchor's id).
  const groupKey = (p: Product) => p.variantGroupId ?? p.id;
  const groupSizeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of data ?? []) {
      const key = groupKey(p);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [data]);
  const extraSizesFor = (p: Product) => (groupSizeCounts.get(groupKey(p)) ?? 1) - 1;

  /** Disabling hides a product from selling, alerts and forecasts without losing its history. */
  const handleToggleActive = async (product: Product) => {
    if (!usesLiveData() || !activeBusiness) {
      showToast(t('Changing a product needs an active business. Please sign in again.'), 'info');
      return;
    }

    const enabling = !product.isActive;
    if (!enabling) {
      const confirmed = await confirmAction({
        title: t('Disable {{name}}?', { name: product.name }),
        text: t('It will stay in Inventory with its history, but can no longer be sold and is left out of alerts and forecasts. You can enable it again anytime.'),
        confirmLabel: t('Disable'),
      });
      if (!confirmed) return;
    }

    try {
      await productService.update(activeBusiness.id, product.id, { isActive: enabling });
      showToast(enabling ? t('{{name}} was enabled.', { name: product.name }) : t('{{name}} was disabled.', { name: product.name }));
      reload();
    } catch (err) {
      await alertError(enabling ? t('Could not enable this product') : t('Could not disable this product'), toUserMessage(err));
    }
  };

  /** Quick correction from the list, without drilling into the product's detail page. */
  const handleAdjustStock = async (product: Product) => {
    if (!usesLiveData() || !activeBusiness) {
      showToast(t('Adjusting stock needs an active business. Please sign in again.'), 'info');
      return;
    }

    const quantity = await promptNumber({
      title: t('Adjust stock for {{name}}', { name: product.name }),
      text: t('Currently {{v1}} {{unit}}. Positive to add, negative to remove.', { v1: number(product.currentStock), unit: product.unit }),
      placeholder: t('e.g. -3 or 10'),
    });
    if (quantity === null) return;

    try {
      await productService.adjustStock(activeBusiness.id, product.id, quantity);
      reload();
      await alertSuccess(t('Stock adjusted'),
        quantity > 0
          ? t('Added {{qty}} {{unit}}.', { qty: number(Math.abs(quantity)), unit: product.unit })
          : t('Removed {{qty}} {{unit}}.', { qty: number(Math.abs(quantity)), unit: product.unit }),
      );
    } catch (err) {
      await alertError(t('Could not adjust stock'), toUserMessage(err));
    }
  };

  /**
   * The category dropdown's "+ Add new category" option routes here instead
   * of actually selecting it. `previous` is restored on every exit path but
   * success, so the <select> never visibly gets stuck on that sentinel row.
   */
  const handleAddCategory = async () => {
    const previous = form.categoryId;

    if (!usesLiveData() || !activeBusiness) {
      setField('categoryId')(previous);
      setFormError(t('Adding a category needs an active business. Please sign in again.'));
      return;
    }
    if (!isManager) {
      setField('categoryId')(previous);
      await alertError(t('Only an owner or admin can add categories'));
      return;
    }

    const name = await promptText({
      title: t('New category'),
      placeholder: t('e.g. Beverages'),
      confirmLabel: t('Add'),
    });
    if (!name) {
      setField('categoryId')(previous);
      return;
    }

    try {
      const created = await categoryService.create(activeBusiness.id, name);
      await reloadCategories();
      setField('categoryId')(created.id);
    } catch (err) {
      setField('categoryId')(previous);
      await alertError(t('Could not add this category'), toUserMessage(err));
    }
  };

  /**
   * Deletes the category currently selected in the form. A category still
   * assigned to any product is never deletable — the schema itself would
   * only orphan those products to "Uncategorised" (ON DELETE SET NULL), but
   * that silent fallback isn't what we want here, so it's blocked outright
   * with a clear reason instead.
   */
  const handleDeleteCategory = async () => {
    const cat = (dbCategories ?? []).find((c) => c.id === form.categoryId);
    if (!cat || !activeBusiness) return;

    if (!isManager) {
      await alertError(t('Only an owner or admin can delete categories'));
      return;
    }

    const productsInUse = (data ?? []).filter((p) => p.category === cat.name).length;
    if (productsInUse > 0) {
      await alertError(t('This category is in use'),
        productsInUse === 1
          ? t('1 product uses "{{category}}". Reassign or remove it before deleting this category.', { category: cat.name })
          : t('{{count}} products use "{{category}}". Reassign or remove them before deleting this category.', { count: productsInUse, category: cat.name }),
      );
      return;
    }

    const confirmed = await confirmAction({
      title: t('Delete {{name}}?', { name: cat.name }),
      text: t('This category is not used by any product. This action cannot be undone.'),
      confirmLabel: t('Delete'),
    });
    if (!confirmed) return;

    try {
      await categoryService.remove(activeBusiness.id, cat.id);
      await reloadCategories();
      setField('categoryId')('');
      showToast(t('{{name}} was deleted.', { name: cat.name }));
    } catch (err) {
      await alertError(t('Could not delete this category'), toUserMessage(err));
    }
  };

  const handleSave = async () => {
    setFormError(null);

    if (!form.name.trim()) {
      setFormError(t('Enter a product name.'));
      return;
    }
    if (!form.unit.trim()) {
      setFormError(t('Enter a unit, for example bottles or packs.'));
      return;
    }
    for (const unit of subUnits) {
      if (!unit.name.trim()) {
        setFormError(t('Enter a name for each size you added.'));
        return;
      }
      if (!unit.unit.trim()) {
        setFormError(t('Enter a unit for "{{name}}", for example bottles or packs.', { name: unit.name }));
        return;
      }
    }

    if (!usesLiveData() || !activeBusiness) {
      setFormError(t('Saving needs an active business. Please sign in again.'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku || null,
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null,
        unit: form.unit,
        minimumStock: Number(form.minimumStock) || 0,
        reorderQuantity: Number(form.reorderQuantity) || 0,
        costPrice: Number(form.costPrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
      };
      const name = form.name.trim();
      const wasAdding = !editingProductId;
      let primaryId = editingProductId;

      if (editingProductId) {
        await productService.update(activeBusiness.id, editingProductId, payload);
        await syncPhoto(activeBusiness.id, editingProductId);
      } else {
        const created = await productService.create(activeBusiness.id, {
          ...payload,
          openingStock: Number(form.openingStock) || 0,
        });
        primaryId = created.id;
        // Promote to "editing" this now-real product — if a size below fails
        // and the user retries, this stops the primary from being created a
        // second time.
        setEditingProductId(created.id);
        await syncPhoto(activeBusiness.id, created.id);
      }

      // Every size anchors to the same original product, even if this one is
      // itself a sibling opened from its own edit screen.
      const anchorId = editingVariantGroupId ?? primaryId!;

      const stillPending: SubUnitForm[] = [];
      const failedNames: string[] = [];

      for (const unit of subUnits) {
        try {
          const createdUnit = await productService.create(activeBusiness.id, {
            name: unit.name,
            sku: unit.sku || null,
            categoryId: unit.categoryId || null,
            supplierId: unit.supplierId || null,
            unit: unit.unit,
            minimumStock: Number(unit.minimumStock) || 0,
            reorderQuantity: Number(unit.reorderQuantity) || 0,
            costPrice: Number(unit.costPrice) || 0,
            sellingPrice: Number(unit.sellingPrice) || 0,
            openingStock: Number(unit.openingStock) || 0,
            variantGroupId: anchorId,
          });
          if (unit.imageFile) {
            try {
              await productService.uploadImage(activeBusiness.id, createdUnit.id, unit.imageFile);
            } catch {
              showToast(t('{{name}} saved, but its photo could not be uploaded.', { name: unit.name }), 'info');
            }
          }
        } catch (err) {
          failedNames.push(unit.name);
          stillPending.push(unit);
        }
      }

      setSubUnits(stillPending);

      if (failedNames.length > 0) {
        setFormError(
          failedNames.length === 1
            ? t('{{name}} was saved, but this size could not be added: {{failed}}. Fix and try again.', { name, failed: failedNames.join(', ') })
            : t('{{name}} was saved, but these sizes could not be added: {{failed}}. Fix and try again.', { name, failed: failedNames.join(', ') }),
        );
        return;
      }

      const sizesAdded = subUnits.length;
      closeModal();
      reload();
      if (sizesAdded > 0) {
        showToast(sizesAdded > 1 ? t('{{count}} additional sizes added.', { count: sizesAdded }) : t('1 additional size added.'));
      }
      await alertSuccess(
        wasAdding ? t('Product added') : t('Product updated'),
        wasAdding ? t('{{name}} is now in your inventory.', { name }) : t('{{name}} has been updated.', { name }),
      );
    } catch (err) {
      setFormError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <PageHeader
      title={t('Inventory')}
      description={t('Track stock levels, minimums and supplier pricing across your products.')}
      actions={
        <Button
          variant="primary"
          icon={addOutline}
          onClick={() => {
            setEditingProductId(null);
            setEditingVariantGroupId(null);
            setForm(BLANK_FORM);
            resetImageState();
            resetSubUnits();
            setAddOpen(true);
          }}
        >
          {t('Add Product')}
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading your products')}>
          <SkeletonRows rows={6} />
        </LoadingState>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <ErrorState
          title={t('Unable to load inventory')}
          description={t('We could not load your product list. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  return (
    <>
      {header}

      <Toolbar>
        <ToolbarSearch>
          <SearchInput
            label={t('Search products by name or product code')}
            placeholder={t('Search products')}
            value={query}
            onValueChange={setQuery}
          />
        </ToolbarSearch>

        <ToolbarFilters>
          <SelectField
            label={t('Filter by category')}
            hideLabel
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { value: 'all', label: t('All categories') },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
        </ToolbarFilters>
      </Toolbar>

      <div className="bl-inv__chips">
        <ChipFilter
          label={t('Filter by stock status')}
          value={status}
          onChange={setStatus}
          options={STATUS_FILTERS.map((f) => ({
            ...f,
            count: counts[f.value as keyof typeof counts],
          }))}
        />
      </div>

      <ResultCount shown={filtered.length} total={data.length} noun="products" />

      {filtered.length === 0 ? (
        data.length === 0 ? (
          <EmptyState
            icon={cubeOutline}
            title={t('No products yet')}
            description={t('Add your first product using the button above to start monitoring your inventory.')}
          />
        ) : (
          <EmptyState
            icon={searchOutline}
            title={t('No products match your filters')}
            description={t('Try a different search term, category or stock status.')}
            actionLabel={t('Clear filters')}
            onAction={() => {
              setQuery('');
              setStatus('all');
              setCategory('all');
            }}
            compact
          />
        )
      ) : (
        <>
          {/* Desktop: full table */}
          <div className="bl-responsive-table">
            <Card padding="none">
              <div className="bl-table-wrap bl-scroll">
                <table className="bl-table bl-table--clickable">
                  <caption className="bl-sr-only">
                    {t('Products with stock levels, supplier and pricing. Select a row for details.')}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('Product')}</th>
                      <th scope="col">{t('Category')}</th>
                      <th scope="col" className="bl-td-num">
                        {t('Stock')}
                      </th>
                      <th scope="col" className="bl-td-num">
                        {t('Minimum')}
                      </th>
                      <th scope="col" className="bl-inv__col-supplier">
                        {t('Supplier')}
                      </th>
                      <th scope="col" className="bl-td-num">
                        {t('Price')}
                      </th>
                      <th scope="col">{t('Status')}</th>
                      <th scope="col" className="bl-td-actions">
                        <span className="bl-sr-only">{t('Actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((product) => (
                      <tr
                        key={product.id}
                        className={product.isActive ? undefined : 'bl-inv__row--disabled'}
                        onClick={() => history.push(`/inventory/${product.id}`)}
                      >
                        <td>
                          <div className="bl-inv__row-photo">
                            <ProductThumbnail src={product.imageUrl} name={product.name} size="sm" />
                            <div>
                              <a
                                className="bl-table__primary bl-inv__namelink"
                                href={`/inventory/${product.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  history.push(`/inventory/${product.id}`);
                                }}
                              >
                                {product.name}
                              </a>
                              {extraSizesFor(product) > 0 && (
                                <Badge tone="neutral">{extraSizesFor(product) > 1 ? t('+{{count}} sizes', { count: extraSizesFor(product) }) : t('+1 size')}</Badge>
                              )}
                              <div className="bl-table__sub">{product.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td>{product.category}</td>
                        <td className="bl-td-num">
                          {number(product.currentStock)}
                          <div className="bl-table__sub">{product.unit}</div>
                        </td>
                        <td className="bl-td-num">{number(product.minimumStock)}</td>
                        <td className="bl-inv__col-supplier">{supplierName(product.supplierId)}</td>
                        <td className="bl-td-num">
                          {peso(product.sellingPrice)}
                          <div className="bl-table__sub">{t('cost {{v1}}', { v1: peso(product.costPrice) })}</div>
                        </td>
                        <td>
                          {product.isActive ? (
                            <StatusBadge
                              status={product.status}
                              className={product.status === 'healthy' ? 'bl-inv__status--plain' : undefined}
                            />
                          ) : (
                            <Badge tone="neutral">{t('Disabled')}</Badge>
                          )}
                        </td>
                        <td className="bl-td-actions">
                          <div className="bl-inv__actions">
                            <Button
                              variant="ghost"
                              className="bl-inv__action--stock"
                              size="sm"
                              icon={swapVerticalOutline}
                              aria-label={t('Adjust stock for {{name}}', { name: product.name })}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleAdjustStock(product);
                              }}
                            >
                              {t('Stock')}
                            </Button>
                            <Button
                              variant="ghost"
                              className="bl-inv__action--edit"
                              size="sm"
                              icon={createOutline}
                              aria-label={t('Edit {{name}}', { name: product.name })}
                              disabled={!isManager}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(product);
                              }}
                            >
                              {t('Edit')}
                            </Button>
                            <Button
                              variant="ghost"
                              className={product.isActive ? 'bl-inv__action--delete' : 'bl-inv__action--enable'}
                              size="sm"
                              icon={powerOutline}
                              aria-label={`${product.isActive ? t('Disable') : t('Enable')} ${product.name}`}
                              disabled={!isManager}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleToggleActive(product);
                              }}
                            >
                              {product.isActive ? t('Disable') : t('Enable')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile and tablet: cards */}
          <ul className="bl-responsive-cards">
            {filtered.map((product) => {
              const pct = Math.min(
                100,
                (product.currentStock / Math.max(product.minimumStock, 1)) * 100,
              );
              const fill =
                product.status === 'healthy'
                  ? ''
                  : product.status === 'low'
                    ? 'bl-meter__fill--warning'
                    : 'bl-meter__fill--danger';

              return (
                <li key={product.id}>
                  <article className="bl-drow">
                    <div className="bl-drow__top">
                      <div className="bl-inv__row-photo">
                        <ProductThumbnail src={product.imageUrl} name={product.name} size="sm" />
                        <a
                          className="bl-inv__cardlink"
                          href={`/inventory/${product.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            history.push(`/inventory/${product.id}`);
                          }}
                        >
                          <span className="bl-drow__title">
                            {product.name}
                            {extraSizesFor(product) > 0 && (
                              <Badge tone="neutral">
                                {extraSizesFor(product) > 1 ? t('+{{count}} sizes', { count: extraSizesFor(product) }) : t('+1 size')}
                              </Badge>
                            )}
                          </span>
                          <span className="bl-drow__meta">
                            {product.sku} · {product.category}
                          </span>
                        </a>
                      </div>
                      <StatusBadge
                            status={product.status}
                            className={product.status === 'healthy' ? 'bl-inv__status--plain' : undefined}
                          />
                    </div>

                    <div className="bl-inv__stockbar">
                      <div className="bl-inv__stockbar-head">
                        <span className="bl-caption">
                          {t('{{v1}} {{unit}} on hand', { v1: number(product.currentStock), unit: product.unit })}
                        </span>
                        <span className="bl-caption">min {number(product.minimumStock)}</span>
                      </div>
                      <div
                        className="bl-meter"
                        role="meter"
                        aria-valuenow={product.currentStock}
                        aria-valuemin={0}
                        aria-valuemax={product.minimumStock}
                        aria-label={t('{{name}} stock against minimum', { name: product.name })}
                      >
                        <div className={`bl-meter__fill ${fill}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <dl className="bl-drow__grid">
                      <div className="bl-drow__cell">
                        <dt>{t('Price')}</dt>
                        <dd>{peso(product.sellingPrice)}</dd>
                      </div>
                      <div className="bl-drow__cell">
                        <dt>{t('Supplier')}</dt>
                        <dd className="bl-inv__supplier-sm">{supplierName(product.supplierId)}</dd>
                      </div>
                    </dl>

                    <div className="bl-inv__cardactions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => history.push(`/inventory/${product.id}`)}
                      >
                        {t('View details')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="bl-inv__action--stock"
                        size="sm"
                        icon={swapVerticalOutline}
                        aria-label={t('Adjust stock for {{name}}', { name: product.name })}
                        onClick={() => void handleAdjustStock(product)}
                      >
                        {t('Stock')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="bl-inv__action--edit"
                        size="sm"
                        icon={createOutline}
                        aria-label={t('Edit {{name}}', { name: product.name })}
                        disabled={!isManager}
                        onClick={() => openEditModal(product)}
                      >
                        {t('Edit')}
                      </Button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ---- Add / edit product form -------------------------------------- */}
      <Modal
        isOpen={addOpen}
        onClose={closeModal}
        size="lg"
        title={editingProductId ? t('Edit Product') : t('Add Product')}
        description={
          editingProductId
            ? t("Update this product's details.")
            : t('Record a new product so it can be tracked and forecast.')
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              {saving ? t('Saving') : editingProductId ? t('Save Changes') : t('Save Product')}
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

          <fieldset className="bl-fieldset bl-form-grid__full">
            <legend className="bl-fieldset__legend">{t('Product details')}</legend>
            <div className="bl-inv__photo-row">
              <ProductThumbnail src={photoPreview} name={form.name || '?'} size="lg" />
              <div className="bl-inv__photo-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="bl-sr-only"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={cameraOutline}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview ? t('Change photo') : t('Add photo')}
                </Button>
                {photoPreview && (
                  <Button variant="ghost" size="sm" onClick={handleRemovePhoto}>
                    {t('Remove photo')}
                  </Button>
                )}
              </div>
            </div>
            <div className="bl-form-grid bl-form-grid--3">
              <TextField
                label={t('Product name')}
                placeholder={t('e.g. Cooking Oil 1L')}
                required
                value={form.name}
                onChange={(e) => setField('name')(e.target.value)}
              />
              <TextField
                label={t('Product code')}
                placeholder={t('e.g. CO-1000')}
                hint={t('Your own product code.')}
                value={form.sku}
                onChange={(e) => setField('sku')(e.target.value)}
              />
              <div className="bl-inv__category-row">
                <SelectField
                  label={t('Category')}
                  placeholder={t('Select a category')}
                  className="bl-inv__category-select"
                  value={form.categoryId}
                  onChange={(e) => {
                    if (e.target.value === NEW_CATEGORY_OPTION) {
                      void handleAddCategory();
                      return;
                    }
                    setField('categoryId')(e.target.value);
                  }}
                  options={[
                    { value: NEW_CATEGORY_OPTION, label: t('+ Add new category') },
                    ...(dbCategories ?? []).map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                {form.categoryId && form.categoryId !== NEW_CATEGORY_OPTION && (
                  <Button
                    variant="ghost"
                    icon={trashOutline}
                    aria-label={t('Delete this category')}
                    onClick={() => void handleDeleteCategory()}
                  />
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="bl-fieldset bl-form-grid__full">
            <legend className="bl-fieldset__legend">{t('Stock and pricing')}</legend>
            <div className="bl-form-grid bl-form-grid--3">
              {/* Stock only ever moves through the ledger, so editing an
                  existing product has no "opening stock" to set. */}
              {!editingProductId && (
                <NumberField
                  label={t('Opening stock')}
                  placeholder="0"
                  hint={t('Recorded as an adjustment so it appears in the stock history.')}
                  value={form.openingStock}
                  onChange={(e) => setField('openingStock')(e.target.value)}
                />
              )}
              <TextField
                label={t('Unit')}
                placeholder={t('e.g. bottles')}
                required
                textOnly
                value={form.unit}
                onChange={(e) => setField('unit')(e.target.value)}
              />
              <NumberField
                label={t('Low-stock level')}
                placeholder="0"
                hint={t('You will be alerted below this level.')}
                value={form.minimumStock}
                onChange={(e) => setField('minimumStock')(e.target.value)}
              />
              <NumberField
                label={t('Usual order size')}
                placeholder="0"
                value={form.reorderQuantity}
                onChange={(e) => setField('reorderQuantity')(e.target.value)}
              />
              <CurrencyField
                label={t('Buying price')}
                required
                value={form.costPrice}
                onChange={(e) => setField('costPrice')(e.target.value)}
              />
              <CurrencyField
                label={t('Selling price')}
                required
                value={form.sellingPrice}
                onChange={(e) => setField('sellingPrice')(e.target.value)}
              />
            </div>
          </fieldset>

          <div className="bl-form-grid__full bl-inv__supplier-row">
            <SelectField
              label={t('Supplier')}
              placeholder={t('Select a supplier')}
              className="bl-inv__supplier-select"
              value={form.supplierId}
              onChange={(e) => setField('supplierId')(e.target.value)}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
            <Button variant="secondary" icon={addOutline} onClick={addSubUnit}>
              {t('Add another size')}
            </Button>
          </div>

          {subUnits.map((unit, index) => (
            <fieldset key={unit.localId} className="bl-fieldset bl-form-grid__full bl-inv__subunit">
              <legend className="bl-fieldset__legend bl-inv__subunit-legend">
                <span>{t('Size {{v1}}', { v1: index + 1 })}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={trashOutline}
                  aria-label={t('Remove size {{v1}}', { v1: index + 1 })}
                  onClick={() => removeSubUnit(unit.localId)}
                >
                  {t('Remove')}
                </Button>
              </legend>

              <div className="bl-inv__photo-row">
                <ProductThumbnail src={unit.imagePreviewUrl} name={unit.name || '?'} size="md" />
                <div className="bl-inv__photo-actions">
                  <label className="bl-btn bl-btn--secondary bl-btn--sm">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="bl-sr-only"
                      onChange={(e) =>
                        handleSubUnitPhotoChange(unit.localId, e.target.files?.[0] ?? null)
                      }
                    />
                    {unit.imagePreviewUrl ? t('Change photo') : t('Add photo')}
                  </label>
                  {unit.imagePreviewUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSubUnitPhotoChange(unit.localId, null)}
                    >
                      {t('Remove photo')}
                    </Button>
                  )}
                </div>
              </div>

              <div className="bl-form-grid bl-form-grid--3">
                <TextField
                  label={t('Product name')}
                  placeholder={t('e.g. Coke 500ml')}
                  required
                  value={unit.name}
                  onChange={(e) => updateSubUnit(unit.localId, { name: e.target.value })}
                />
                <TextField
                  label={t('Product code')}
                  placeholder={t('e.g. CK-500')}
                  value={unit.sku}
                  onChange={(e) => updateSubUnit(unit.localId, { sku: e.target.value })}
                />
                <SelectField
                  label={t('Category')}
                  placeholder={t('Select a category')}
                  value={unit.categoryId}
                  onChange={(e) => updateSubUnit(unit.localId, { categoryId: e.target.value })}
                  options={(dbCategories ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
                <SelectField
                  label={t('Supplier')}
                  placeholder={t('Select a supplier')}
                  value={unit.supplierId}
                  onChange={(e) => updateSubUnit(unit.localId, { supplierId: e.target.value })}
                  options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
                />
                <TextField
                  label={t('Unit')}
                  placeholder={t('e.g. bottles')}
                  required
                  textOnly
                  value={unit.unit}
                  onChange={(e) => updateSubUnit(unit.localId, { unit: e.target.value })}
                />
                <NumberField
                  label={t('Opening stock')}
                  placeholder="0"
                  value={unit.openingStock}
                  onChange={(e) => updateSubUnit(unit.localId, { openingStock: e.target.value })}
                />
                <NumberField
                  label={t('Low-stock level')}
                  placeholder="0"
                  value={unit.minimumStock}
                  onChange={(e) => updateSubUnit(unit.localId, { minimumStock: e.target.value })}
                />
                <NumberField
                  label={t('Usual order size')}
                  placeholder="0"
                  value={unit.reorderQuantity}
                  onChange={(e) => updateSubUnit(unit.localId, { reorderQuantity: e.target.value })}
                />
                <CurrencyField
                  label={t('Buying price')}
                  value={unit.costPrice}
                  onChange={(e) => updateSubUnit(unit.localId, { costPrice: e.target.value })}
                />
                <CurrencyField
                  label={t('Selling price')}
                  value={unit.sellingPrice}
                  onChange={(e) => updateSubUnit(unit.localId, { sellingPrice: e.target.value })}
                />
              </div>
            </fieldset>
          ))}
        </form>
      </Modal>
    </>
  );
}

export default Inventory;
