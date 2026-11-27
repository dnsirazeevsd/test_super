#!/usr/bin/env node
/**
 * gen-catalog-accessories.mjs
 *
 * Idempotent generator that EXTENDS (never overwrites) src/data/products.json and
 * src/data/specs.json with the Task 2B assortment:
 *   - Accessories  : subcategory headphones | cases | chargers
 *                    brand Apple | Beats | Samsung | Universal
 *   - Dyson        : separate hair-dryer category (brand Dyson)
 *
 * It is the single source of truth for the 22 new SKUs. Re-running it safely
 * replaces the previously generated block (detected by id prefix `acc-`/`dyson-`
 * and the two new categories) and re-emits the merged files, so the data stays
 * consistent with the schema and with the verification scripts.
 *
 * Compatibility data note (see report): only compatibility that is verifiable
 * from official manufacturer specs is encoded. Cases / the protective glass have
 * NO exact device model, so their `compatibility` is empty — the UI shows
 * «Совместимость уточняется у менеджера» and they are excluded from cross-sell.
 *
 * Image keys note: every `imageKey` below was assigned by OPENING the source
 * photo and matching its content to the product — several assets/source files
 * carry content that differs from their file name (see report table), so the
 * keys intentionally do not always mirror the modelSlug. Two products have no
 * matching photo at all (Samsung 25W EP-T2510, Samsung USB-C cable) and stay
 * `imageKey: null` → UI placeholder.
 *
 * Color variants note: Apple AirPods Max 2 is ONE product record (same id, URL
 * and price as before) with a `colorVariants` array — the same per-color fields
 * (color/colorRu/colorHex/imageKey) that separate color SKUs use. The
 * configurator expands them client-side; no extra SKUs / stock are invented.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PRODUCTS = path.join(ROOT, 'src/data/products.json');
const SPECS = path.join(ROOT, 'src/data/specs.json');

/* ------------------------------------------------------------------ *
 * Device slug sets (existing catalog models) used for compatibility.   *
 * ------------------------------------------------------------------ */
const IPHONE_DEVICES = [
  'iphone-18-pro',
  'iphone-17-pro',
  'iphone-17-pro-max',
  'iphone-17',
  'iphone-17-air',
  'iphone-16-pro',
];
const MACBOOK_DEVICES = ['macbook-air-13-m5', 'macbook-neo-13-a16'];
const SAMSUNG_DEVICES = ['samsung-a57-5g', 'samsung-galaxy-watch-8-ultra'];
const APPLE_DEVICES = [...IPHONE_DEVICES, ...MACBOOK_DEVICES];

const TYPE_LABEL = {
  headphones: 'Наушники',
  cases: 'Чехлы',
  chargers: 'Зарядки и кабели',
  'hair-dryer': 'Фен',
};

/* ------------------------------------------------------------------ *
 * The 22 new SKUs. Prices are unconfirmed presentation prices from the *
 * task brief — listed in the report for owner approval.                *
 * ------------------------------------------------------------------ */
const items = [
  // ---------------- HEADPHONES (8) ----------------
  {
    id: 'acc-airpods-4', legacyId: 'acc-001', category: 'accessories',
    subcategory: 'headphones', brand: 'Apple',
    modelSlug: 'apple-airpods-4', modelTitle: 'Apple AirPods 4',
    title: 'Apple AirPods 4', price: 12990,
    imageKey: 'headphones/apple-airpods-4',
    connector: 'Bluetooth', wattage: null, model: null,
    compatibility: APPLE_DEVICES,
  },
  {
    id: 'acc-airpods-4-anc', legacyId: 'acc-002', category: 'accessories',
    subcategory: 'headphones', brand: 'Apple',
    modelSlug: 'apple-airpods-4-anc', modelTitle: 'Apple AirPods 4 с шумоподавлением (ANC)',
    title: 'Apple AirPods 4 с шумоподавлением (ANC)', price: 14990,
    imageKey: 'headphones/apple-airpods-4-anc',
    connector: 'Bluetooth', wattage: null, model: null,
    compatibility: APPLE_DEVICES,
  },
  {
    id: 'acc-airpods-pro-3', legacyId: 'acc-003', category: 'accessories',
    subcategory: 'headphones', brand: 'Apple',
    modelSlug: 'apple-airpods-pro-3', modelTitle: 'Apple AirPods Pro 3 (USB-C)',
    title: 'Apple AirPods Pro 3 (USB-C)', price: 19990,
    imageKey: 'headphones/apple-airpods-pro-3',
    connector: 'Bluetooth', wattage: null, model: null,
    compatibility: APPLE_DEVICES,
  },
  {
    id: 'acc-airpods-max-2', legacyId: 'acc-004', category: 'accessories',
    subcategory: 'headphones', brand: 'Apple',
    modelSlug: 'apple-airpods-max-2', modelTitle: 'Apple AirPods Max 2 (USB-C)',
    title: 'Apple AirPods Max 2 (USB-C)', price: 42990,
    imageKey: 'headphones/apple-airpods-max-2',
    // One product record, three colors (same id / URL / price — no extra SKUs).
    color: 'Black', colorRu: 'Чёрный', colorHex: '#1F2024',
    colorVariants: [
      { color: 'Black', colorRu: 'Чёрный', colorHex: '#1F2024', imageKey: 'headphones/apple-airpods-max-2' },
      { color: 'Orange', colorRu: 'Оранжевый', colorHex: '#E07A45', imageKey: 'headphones/apple-airpods-max-2-orange' },
      { color: 'Purple', colorRu: 'Фиолетовый', colorHex: '#AA99BB', imageKey: 'headphones/apple-airpods-max-2-purple' },
    ],
    connector: 'Bluetooth', wattage: null, model: null,
    compatibility: APPLE_DEVICES,
  },
  {
    id: 'acc-galaxy-buds-3', legacyId: 'acc-005', category: 'accessories',
    subcategory: 'headphones', brand: 'Samsung',
    modelSlug: 'samsung-galaxy-buds-3', modelTitle: 'Samsung Galaxy Buds 3',
    title: 'Samsung Galaxy Buds 3', price: 8990,
    imageKey: 'headphones/samsung-galaxy-buds-3',
    connector: 'Bluetooth', wattage: null, model: null,
    compatibility: SAMSUNG_DEVICES,
  },
  {
    id: 'acc-galaxy-buds-3-pro', legacyId: 'acc-006', category: 'accessories',
    subcategory: 'headphones', brand: 'Samsung',
    modelSlug: 'samsung-galaxy-buds-3-pro', modelTitle: 'Samsung Galaxy Buds 3 Pro',
    title: 'Samsung Galaxy Buds 3 Pro', price: 11990,
    imageKey: 'headphones/samsung-galaxy-buds-3-pro',
    connector: 'Bluetooth', wattage: null, model: null,
    compatibility: SAMSUNG_DEVICES,
  },
  {
    id: 'acc-galaxy-buds4', legacyId: 'acc-007', category: 'accessories',
    subcategory: 'headphones', brand: 'Samsung',
    modelSlug: 'samsung-galaxy-buds4', modelTitle: 'Samsung Galaxy Buds4',
    title: 'Samsung Galaxy Buds4', price: 10990,
    imageKey: 'headphones/samsung-galaxy-buds4',
    connector: 'Bluetooth', wattage: null, model: null,
    compatibility: SAMSUNG_DEVICES,
  },
  {
    id: 'acc-galaxy-buds4-pro', legacyId: 'acc-008', category: 'accessories',
    subcategory: 'headphones', brand: 'Samsung',
    modelSlug: 'samsung-galaxy-buds4-pro', modelTitle: 'Samsung Galaxy Buds4 Pro',
    title: 'Samsung Galaxy Buds4 Pro', price: 13990,
    imageKey: 'headphones/samsung-galaxy-buds4-pro',
    connector: 'Bluetooth', wattage: null, model: null,
    compatibility: SAMSUNG_DEVICES,
  },

  // ---------------- CASES (5) — no exact device model known ----------------
  {
    id: 'acc-apple-silicone-case', legacyId: 'acc-009', category: 'accessories',
    subcategory: 'cases', brand: 'Apple',
    modelSlug: 'apple-silicone-case-magsafe', modelTitle: 'Apple Silicone Case с MagSafe',
    title: 'Apple Silicone Case с MagSafe', price: 4990,
    // Photo content: black Apple-branded case (file apple-clear-case-magsafe.jpg).
    imageKey: 'accessories/apple-clear-case-magsafe',
    connector: null, wattage: null, model: null,
    compatibility: [],
    material: 'Силикон',
  },
  {
    id: 'acc-apple-clear-case', legacyId: 'acc-010', category: 'accessories',
    subcategory: 'cases', brand: 'Apple',
    modelSlug: 'apple-clear-case-magsafe', modelTitle: 'Apple Clear Case с MagSafe',
    title: 'Apple Clear Case с MagSafe', price: 4990,
    // Photo content: transparent case with MagSafe ring (file samsung-silicone-case.jpg).
    imageKey: 'accessories/samsung-silicone-case',
    connector: null, wattage: null, model: null,
    compatibility: [],
    material: 'Прозрачный поликарбонат',
  },
  {
    id: 'acc-beats-case', legacyId: 'acc-011', category: 'accessories',
    subcategory: 'cases', brand: 'Beats',
    modelSlug: 'beats-case-magsafe-camera-control', modelTitle: 'Beats Case с MagSafe и Camera Control',
    title: 'Beats Case с MagSafe и Camera Control', price: 5490,
    imageKey: 'accessories/beats-case-magsafe-camera-control',
    connector: null, wattage: null, model: null,
    compatibility: [],
    material: 'Прозрачный поликарбонат',
  },
  {
    id: 'acc-samsung-silicone-case', legacyId: 'acc-012', category: 'accessories',
    subcategory: 'cases', brand: 'Samsung',
    modelSlug: 'samsung-silicone-case', modelTitle: 'Samsung Silicone Case для Galaxy',
    title: 'Samsung Silicone Case для Galaxy', price: 2990,
    // Photo content: navy Samsung-branded silicone case (file apple-silicone-case-magsafe.jpg).
    imageKey: 'accessories/apple-silicone-case-magsafe',
    connector: null, wattage: null, model: null,
    compatibility: [],
    material: 'Силикон',
  },
  {
    id: 'acc-protective-glass', legacyId: 'acc-013', category: 'accessories',
    subcategory: 'cases', brand: 'Universal',
    modelSlug: 'protective-glass-framed', modelTitle: 'Защитное стекло с установочной рамкой',
    title: 'Защитное стекло с установочной рамкой', price: 1490,
    // Photo content: glass + installation frame (file apple-usbc-adapter-20w.jpg).
    imageKey: 'accessories/apple-usbc-adapter-20w',
    connector: null, wattage: null, model: null,
    compatibility: [],
    material: 'Закалённое стекло',
  },

  // ---------------- CHARGERS & CABLES (7) ----------------
  {
    id: 'acc-apple-20w', legacyId: 'acc-014', category: 'accessories',
    subcategory: 'chargers', brand: 'Apple',
    modelSlug: 'apple-usbc-adapter-20w', modelTitle: 'Адаптер питания Apple USB-C 20W',
    title: 'Адаптер питания Apple USB-C 20W', price: 2490,
    // Photo content: Apple adapter printed «20W USB-C Power Adapter» (file protective-glass-framed.jpg).
    imageKey: 'accessories/protective-glass-framed',
    connector: 'USB-C', wattage: 20, model: null,
    compatibility: APPLE_DEVICES,
  },
  {
    id: 'acc-apple-35w', legacyId: 'acc-015', category: 'accessories',
    subcategory: 'chargers', brand: 'Apple',
    modelSlug: 'apple-usbc-adapter-35w-2port', modelTitle: 'Адаптер питания Apple USB-C 35W (2 порта)',
    title: 'Адаптер питания Apple USB-C 35W (2 порта)', price: 5490,
    imageKey: 'accessories/apple-usbc-adapter-35w-2port',
    connector: 'USB-C', wattage: 35, model: null,
    compatibility: APPLE_DEVICES,
  },
  {
    id: 'acc-apple-magsafe', legacyId: 'acc-016', category: 'accessories',
    subcategory: 'chargers', brand: 'Apple',
    modelSlug: 'apple-magsafe-charger-25w', modelTitle: 'Беспроводное зарядное устройство Apple MagSafe Charger (25W)',
    title: 'Беспроводное зарядное устройство Apple MagSafe Charger (25W)', price: 3990,
    imageKey: 'accessories/apple-magsafe-charger-25w',
    connector: 'USB-C', wattage: 25, model: null,
    compatibility: IPHONE_DEVICES, // MagSafe puck is iPhone-only
  },
  {
    id: 'acc-samsung-45w', legacyId: 'acc-017', category: 'accessories',
    subcategory: 'chargers', brand: 'Samsung',
    modelSlug: 'samsung-45w-charger-cable', modelTitle: 'Сетевое зарядное устройство Samsung 45W USB-C + кабель',
    title: 'Сетевое зарядное устройство Samsung 45W USB-C + кабель', price: 3690,
    imageKey: 'accessories/samsung-45w-charger-cable',
    connector: 'USB-C', wattage: 45, model: null,
    compatibility: SAMSUNG_DEVICES,
  },
  {
    id: 'acc-samsung-25w', legacyId: 'acc-018', category: 'accessories',
    subcategory: 'chargers', brand: 'Samsung',
    modelSlug: 'samsung-25w-charger-ept2510', modelTitle: 'Сетевое зарядное устройство Samsung 25W USB-C, без кабеля (EP-T2510)',
    title: 'Сетевое зарядное устройство Samsung 25W USB-C, без кабеля (EP-T2510)', price: 1990,
    connector: 'USB-C', wattage: 25, model: null,
    compatibility: SAMSUNG_DEVICES,
  },
  {
    id: 'acc-samsung-cable', legacyId: 'acc-019', category: 'accessories',
    subcategory: 'chargers', brand: 'Samsung',
    modelSlug: 'samsung-usbc-cable', modelTitle: 'Кабель Samsung USB-C — USB-C',
    title: 'Кабель Samsung USB-C — USB-C', price: 990,
    connector: 'USB-C', wattage: null, model: null,
    compatibility: SAMSUNG_DEVICES,
  },
  {
    id: 'acc-apple-cable', legacyId: 'acc-020', category: 'accessories',
    subcategory: 'chargers', brand: 'Apple',
    modelSlug: 'apple-usbc-cable-braided-1m', modelTitle: 'Кабель Apple USB-C (плетёный, 1 м)',
    title: 'Кабель Apple USB-C (плетёный, 1 м)', price: 2190,
    imageKey: 'accessories/apple-usbc-cable-braided-1m',
    connector: 'USB-C', wattage: null, model: null,
    compatibility: APPLE_DEVICES,
  },

  // ---------------- DYSON (2) — hair-dryer category ----------------
  {
    id: 'dyson-hd16', legacyId: 'dys-001', category: 'dyson',
    subcategory: 'hair-dryer', brand: 'Dyson',
    modelSlug: 'dyson-supersonic-nural-hd16', modelTitle: 'Фен Dyson Supersonic Nural (HD16)',
    title: 'Фен Dyson Supersonic Nural (HD16)', price: 34990,
    imageKey: 'accessories/dyson-supersonic-nural-hd16',
    connector: null, wattage: null, model: 'HD16',
    compatibility: ['dyson-supersonic-r-pro-hd18'],
  },
  {
    id: 'dyson-hd18', legacyId: 'dys-002', category: 'dyson',
    subcategory: 'hair-dryer', brand: 'Dyson',
    modelSlug: 'dyson-supersonic-r-pro-hd18', modelTitle: 'Фен Dyson Supersonic r Professional (HD18)',
    title: 'Фен Dyson Supersonic r Professional (HD18)', price: 32990,
    imageKey: 'accessories/dyson-supersonic-r-pro-hd18',
    connector: null, wattage: null, model: 'HD18',
    compatibility: ['dyson-supersonic-nural-hd16'],
  },
];

/* ------------------------------------------------------------------ *
 * Build full product records from the compact definitions above.        *
 * ------------------------------------------------------------------ */
function compatLabel(it) {
  if (!it.compatibility || it.compatibility.length === 0) {
    return 'Совместимость уточняется у менеджера';
  }
  if (it.category === 'dyson') {
    return it.modelSlug.includes('hd16')
      ? 'Dyson Supersonic r Professional (HD18)'
      : 'Dyson Supersonic Nural (HD16)';
  }
  if (it.subcategory === 'headphones') return 'Любое устройство с Bluetooth';
  if (it.subcategory === 'chargers') {
    return it.brand === 'Samsung'
      ? 'Устройства с разъёмом USB-C (Samsung)'
      : 'Устройства с разъёмом USB-C (iPhone, MacBook)';
  }
  return 'Совместимость уточняется у менеджера';
}

function buildProduct(it) {
  return {
    id: it.id,
    legacyId: it.legacyId,
    category: it.category,
    modelSlug: it.modelSlug,
    modelTitle: it.modelTitle,
    title: it.title,
    sourceTitle: it.title,
    price: it.price,
    currency: 'RUB',
    storage: null,
    storageSlug: null,
    color: it.color ?? null,
    colorRu: it.colorRu ?? null,
    colorHex: it.colorHex ?? null,
    ...(it.colorVariants ? { colorVariants: it.colorVariants } : {}),
    sim: null,
    simSlug: null,
    imageKey: it.imageKey ?? null,
    isTemporaryPhoto: false,
    inStock: true,
    status: 'Новый, запечатанный',
    note: null,
    description: null,
    specs: [],
    // Task 2B accessory / Dyson attributes (optional, schema-tolerant)
    subcategory: it.subcategory,
    brand: it.brand,
    compatibility: it.compatibility || [],
    connector: it.connector ?? null,
    model: it.model ?? null,
    wattage: it.wattage ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Build spec groups for each new model. Every entry keeps a non-empty   *
 * "groups" array (validated by verify-data). Only verifiable,           *
 * manufacturer-consistent facts are encoded.                            *
 * ------------------------------------------------------------------ */
function buildSpecs(it) {
  const itemsOut = [
    { label: 'Тип', value: TYPE_LABEL[it.subcategory] || it.subcategory },
    { label: 'Бренд', value: it.brand },
    { label: 'Совместимость', value: compatLabel(it) },
  ];
  if (it.subcategory === 'chargers') {
    if (it.wattage != null) itemsOut.push({ label: 'Мощность', value: `${it.wattage} Вт` });
    if (it.connector) itemsOut.push({ label: 'Разъём', value: it.connector });
  }
  if (it.subcategory === 'headphones' && it.connector) {
    itemsOut.push({ label: 'Подключение', value: it.connector });
  }
  if (it.subcategory === 'cases') {
    if (it.material) itemsOut.push({ label: 'Материал', value: it.material });
  }
  if (it.category === 'dyson' && it.model) {
    itemsOut.push({ label: 'Серия', value: it.model });
  }
  return {
    category: it.category,
    groups: [{ group: 'Основные характеристики', items: itemsOut }],
  };
}

/* ------------------------------------------------------------------ *
 * Merge into existing products.json.                                   *
 * ------------------------------------------------------------------ */
const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf-8'));
const EXISTING = products.items.filter(
  (i) => !(i.id && (i.id.startsWith('acc-') || i.id.startsWith('dyson-')))
);
const newProducts = items.map(buildProduct);
products.items = [...EXISTING, ...newProducts];

const EXISTING_CATS = products.categories.filter(
  (c) => c.slug !== 'accessories' && c.slug !== 'dyson'
);
products.categories = [
  ...EXISTING_CATS,
  {
    slug: 'accessories',
    title: 'Аксессуары',
    description:
      'Оригинальные аксессуары Apple, Beats, Samsung и универсальные решения в наличии в ТРЦ «РИО»: наушники, чехлы, зарядные устройства и кабели.',
    heroImageKey: null,
  },
  {
    slug: 'dyson',
    title: 'Dyson',
    description:
      'Фены Dyson Supersonic в наличии в офлайн-магазине SUPER STORE (ТРЦ «РИО», Санкт-Петербург): Nural (HD16) и r Professional (HD18).',
    heroImageKey: null,
  },
];

fs.writeFileSync(PRODUCTS, JSON.stringify(products, null, 2) + '\n');

/* ------------------------------------------------------------------ *
 * Merge into existing specs.json.                                     *
 * ------------------------------------------------------------------ */
const specs = JSON.parse(fs.readFileSync(SPECS, 'utf-8'));
specs.models = specs.models || {};
for (const it of items) {
  specs.models[it.modelSlug] = buildSpecs(it);
}
fs.writeFileSync(SPECS, JSON.stringify(specs, null, 2) + '\n');

/* ------------------------------------------------------------------ *
 * Console summary + report fragment.                                  *
 * ------------------------------------------------------------------ */
const bySub = { headphones: 0, cases: 0, chargers: 0, 'hair-dryer': 0 };
for (const it of items) bySub[it.subcategory]++;
console.log('Appended products:', newProducts.length);
console.log('Accessories total:', bySub.headphones + bySub.cases + bySub.chargers,
  `(headphones ${bySub.headphones}, cases ${bySub.cases}, chargers ${bySub.chargers})`);
console.log('Dyson total:', bySub['hair-dryer']);
console.log('Total products.json items:', products.items.length);
console.log('Specs models:', Object.keys(specs.models).length);
