// Pure, framework-agnostic helpers for product specifications.
//
// Used by:
//   - src/components/ProductConfigurator.tsx  (client + SSR hydration)
//   - scripts/verify-data.mjs                 (build-time validation)
//
// Keeping this logic in one place means the rendered summary and the verified
// summary can never drift apart (single source of truth for summary rules).

/** Categories whose products are phones and therefore expose Серия/Память/Цвет/SIM. */
export const SMARTPHONE_CATEGORIES = ['iphone', 'samsung'];

/** Fallback shown for a core variant field the catalog does not pin down. */
export const UNKNOWN_VALUE = 'Уточняйте у менеджера';

/**
 * Per-category compact summary fields (the four default characteristics).
 * `variant` resolves from the selected product configuration; `specLabel`
 * resolves from the series-level specification groups. Fields that cannot
 * resolve are dropped — e.g. SIM never appears for a console.
 */
export const SUMMARY_FIELDS = {
  iphone: [
    { label: 'Серия', variant: 'series' },
    { label: 'Память', variant: 'storage' },
    { label: 'Цвет', variant: 'color' },
    { label: 'SIM-карта', variant: 'sim' },
  ],
  samsung: [
    { label: 'Серия', variant: 'series' },
    { label: 'Память', variant: 'storage' },
    { label: 'Цвет', variant: 'color' },
    { label: 'SIM-карта', variant: 'sim' },
  ],
  macbook: [
    { label: 'Серия', variant: 'series' },
    { label: 'Память', variant: 'storage' },
    { label: 'Процессор', specLabel: 'Процессор' },
    { label: 'Экран', specLabel: 'Диагональ экрана' },
  ],
  watch: [
    { label: 'Серия', variant: 'series' },
    { label: 'Размер корпуса', specLabel: 'Размер корпуса' },
    { label: 'Совместимость', specLabel: 'Совместимость' },
    { label: 'Материал корпуса', specLabel: 'Материал корпуса' },
  ],
  consoles: [
    { label: 'Серия', variant: 'series' },
    { label: 'Тип', specLabel: 'Тип' },
    { label: 'Накопитель', specLabel: 'Накопитель' },
    { label: 'Графический процессор', specLabel: 'Графический процессор' },
  ],
};

/** The summary fields that MUST resolve to a non-empty value per category. */
export const REQUIRED_SUMMARY_FIELDS = {
  iphone: ['Серия', 'Память', 'Цвет', 'SIM-карта'],
  samsung: ['Серия', 'Память', 'Цвет', 'SIM-карта'],
  macbook: ['Серия', 'Память', 'Процессор', 'Экран'],
  watch: ['Серия', 'Размер корпуса', 'Совместимость', 'Материал корпуса'],
  consoles: ['Серия', 'Тип', 'Накопитель', 'Графический процессор'],
};

function colorDisplay(item) {
  if (!item || !item.color) return null;
  if (item.colorRu && item.colorRu !== item.color) return `${item.color} (${item.colorRu})`;
  return item.color;
}

/**
 * Resolve a single summary field definition against the current product
 * configuration and the series-level spec groups.
 */
export function resolveSummaryField(field, item, specGroups) {
  if (field.variant === 'series') return item?.modelTitle || null;
  if (field.variant === 'storage') return item?.storage || null;
  if (field.variant === 'color') return colorDisplay(item);
  if (field.variant === 'sim') return item?.sim || null;
  if (field.specLabel) {
    for (const g of specGroups || []) {
      const it = (g.items || []).find((i) => i && i.label === field.specLabel);
      if (it) return it.value;
    }
    return null;
  }
  return null;
}

/**
 * Build the compact (default) summary list for a product. Variant fields that
 * are missing on a phone fall back to UNKNOWN_VALUE so the four-field template
 * stays intact; irrelevant fields (e.g. SIM on a console) are simply omitted.
 */
export function buildSummary(category, item, specGroups) {
  const fields = SUMMARY_FIELDS[category] || SUMMARY_FIELDS.iphone;
  const out = [];
  for (const f of fields) {
    let value = resolveSummaryField(f, item, specGroups);
    if (value == null && f.variant === 'color' && SMARTPHONE_CATEGORIES.includes(category)) {
      value = UNKNOWN_VALUE;
    }
    if (value == null && f.variant === 'sim' && SMARTPHONE_CATEGORIES.includes(category)) {
      value = UNKNOWN_VALUE;
    }
    if (value == null || value === '') continue;
    out.push({ label: f.label, value: String(value) });
  }
  return out;
}

/**
 * Validate one model's structured spec entry.
 * Returns a list of human-readable error strings (empty array === valid).
 */
export function validateModelSpecs(modelSlug, entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    errors.push(`specs["${modelSlug}"]: missing or invalid entry`);
    return errors;
  }
  const groups = entry.groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    errors.push(`specs["${modelSlug}"]: must have a non-empty "groups" array`);
    return errors;
  }
  const seenGroups = new Set();
  for (const g of groups) {
    if (!g || typeof g.group !== 'string' || g.group.trim() === '') {
      errors.push(`specs["${modelSlug}"]: group with empty name`);
      continue;
    }
    if (seenGroups.has(g.group)) {
      errors.push(`specs["${modelSlug}"]: duplicated group "${g.group}"`);
    }
    seenGroups.add(g.group);

    if (!Array.isArray(g.items) || g.items.length === 0) {
      errors.push(`specs["${modelSlug}"].${g.group}: must have a non-empty "items" array`);
      continue;
    }
    const seenLabels = new Set();
    for (const it of g.items) {
      if (!it || typeof it.label !== 'string' || it.label.trim() === '') {
        errors.push(`specs["${modelSlug}"].${g.group}: item with empty label`);
        continue;
      }
      if (typeof it.value !== 'string' || it.value.trim() === '') {
        errors.push(`specs["${modelSlug}"].${g.group}: empty value for "${it.label}"`);
        continue;
      }
      if (seenLabels.has(it.label)) {
        errors.push(`specs["${modelSlug}"].${g.group}: duplicated label "${it.label}"`);
      }
      seenLabels.add(it.label);
    }
  }
  return errors;
}
