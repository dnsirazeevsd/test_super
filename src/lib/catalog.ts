import fs from 'node:fs';
import path from 'node:path';
import productsData from '../data/products.json';
import siteData from '../data/site.json';
import imageManifest from '../data/image-manifest.json';
import imageRegistry from '../data/images.json';
import specsData from '../data/specs.json';

export type ProductSpec = string | { label: string; value: string };

/** A single specification group (e.g. «Экран») with its label/value rows. */
export interface ProductSpecGroup {
  group: string;
  items: Array<{ label: string; value: string }>;
}

/** Per-model structured specifications, keyed by modelSlug. */
export interface ModelSpecs {
  category: string;
  groups: ProductSpecGroup[];
}

export interface ProductItem {
  id: string;
  legacyId: string;
  category: string;
  modelSlug: string;
  modelTitle: string;
  title: string;
  sourceTitle: string;
  price: number;
  currency: string;
  storage: string | null;
  storageSlug: string | null;
  color: string | null;
  colorRu: string | null;
  colorHex: string | null;
  sim: string | null;
  simSlug: string | null;
  imageKey: string | null;
  images?: string[];
  isTemporaryPhoto: boolean;
  inStock: boolean;
  status: string;
  note: string | null;
  description?: string | null;
  specs?: ProductSpec[];
}

export interface CategoryInfo {
  slug: string;
  title: string;
  description: string;
  heroImageKey: string;
}

export interface ImageAsset {
  key: string;
  original: string;
  width: number;
  height: number;
  aspectRatio: number;
  avifSrcset: string;
  webpSrcset: string;
  src: string;
}

export interface ProductModelGroup {
  modelSlug: string;
  modelTitle: string;
  category: string;
  categoryTitle: string;
  url: string;
  minPrice: number;
  maxPrice: number;
  hasMultipleConfigs: boolean;
  configCount: number;
  defaultImageKey: string | null;
  isTemporaryPhoto: boolean;
  inStock: boolean;
  storages: string[];
  colors: Array<{ name: string; nameRu: string | null; hex: string; imageKey: string | null }>;
  sims: string[];
  items: ProductItem[];
}

export interface DeliveryOption {
  id: string;
  label: string;
  detail: string;
  price: number;
  priceLabel: string;
}

/** Strip raw technical IDs / UUIDs if ever present in titles or subtitles. */
export function cleanProductTitle(raw: string): string {
  return raw
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '')
    .replace(/\s*(?:#|id[:\s-]*)\d{5,}\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const ALL_PRODUCTS: ProductItem[] = (productsData.items as ProductItem[]).map((item) => ({
  ...item,
  modelTitle: cleanProductTitle(item.modelTitle),
  title: cleanProductTitle(item.title),
  inStock: Boolean(item.inStock),
}));
export const CATEGORIES: CategoryInfo[] = productsData.categories as CategoryInfo[];
export const MANIFEST: Record<string, ImageAsset> = imageManifest as Record<string, ImageAsset>;

/**
 * Series-level specifications, keyed by modelSlug. Shared across every variant of
 * a model (storage / colour / SIM differ per SKU and are shown separately in the
 * compact summary). Returns an empty array when a model has no spec entry, so the
 * caller can decide how to handle it.
 */
const SPECS_BY_MODEL = (specsData as { models?: Record<string, ModelSpecs> }).models ?? {};

export function getModelSpecs(modelSlug: string): ProductSpecGroup[] {
  return SPECS_BY_MODEL[modelSlug]?.groups ?? [];
}

export function getModelSpecCategory(modelSlug: string): string | undefined {
  return SPECS_BY_MODEL[modelSlug]?.category;
}

/**
 * Build-time resolution of owner-supplied product photos. Each entry in
 * images.json -> products points to an expected file in public/images/products/.
 * When the file is present it is wired automatically (catalog tiles, product page
 * gallery, structured data); while it is missing, the «Фото уточняется у менеджера»
 * placeholder stays — the placeholder is the fallback, never a broken image.
 */
interface ExpectedProductPhoto {
  slug: string;
  imageKey: string;
  expectedFile: string;
  width: number;
  height: number;
  alt?: string;
}

const expectedProductPhotos: ExpectedProductPhoto[] =
  (imageRegistry as { products?: ExpectedProductPhoto[] }).products ?? [];

for (const entry of expectedProductPhotos) {
  const absPath = path.join(process.cwd(), 'public', entry.expectedFile);
  if (!fs.existsSync(absPath)) continue;
  MANIFEST[entry.imageKey] = {
    key: entry.imageKey,
    original: entry.expectedFile,
    width: entry.width,
    height: entry.height,
    aspectRatio: Number((entry.width / entry.height).toFixed(4)),
    avifSrcset: '',
    webpSrcset: `${entry.expectedFile} ${entry.width}w`,
    src: entry.expectedFile,
  };
  for (const item of ALL_PRODUCTS) {
    if (item.modelSlug === entry.slug && !item.imageKey) {
      item.imageKey = entry.imageKey;
    }
  }
}

export function getImageAsset(key: string | null | undefined): ImageAsset | null {
  if (!key) return null;
  return MANIFEST[key] ?? null;
}

export function formatPrice(price: number): string {
  return `${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')}\u00A0₽`;
}

/**
 * Telegram link from site.json `telegram: { enabled, username, phone }`.
 * Renders only when `telegram.enabled` is true.
 * With a username -> `https://t.me/<username>`; with only a phone -> `https://t.me/+<phone>` (no `?text=`).
 * Optional prefilled `text` (e.g. a configured product) is appended as `?text=<encoded>`
 * ONLY when a username is set — the phone-only link never carries a `?text=` parameter.
 */
export function isTelegramEnabled(): boolean {
  return Boolean(siteData.telegram?.enabled);
}

/** Raw (no prefilled text) Telegram link, or '' when disabled / nothing configured. */
export function getTelegramBaseUrl(): string {
  const tg = siteData.telegram;
  if (!tg?.enabled) return '';
  const username = (tg.username || '').trim().replace(/^@/, '');
  if (username) return `https://t.me/${username}`;
  const phone = (tg.phone || '').trim().replace(/^\+/, '');
  if (phone) return `https://t.me/+${phone}`;
  return '';
}

export function getTelegramUrl(text?: string): string {
  const base = getTelegramBaseUrl();
  if (!base) return '';
  if (!text) return base;
  const username = (siteData.telegram?.username || '').trim().replace(/^@/, '');
  if (!username) return base; // phone-only link: never append ?text=
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** WhatsApp link from site.json `whatsapp: { enabled, phone }`: `https://wa.me/<phone>`. */
export function isWhatsAppEnabled(): boolean {
  return Boolean(siteData.whatsapp?.enabled);
}

/** WhatsApp link, optionally with a prefilled `text` (URL-encoded, Cyrillic OK). */
export function getWhatsAppUrl(text?: string): string {
  const wa = siteData.whatsapp;
  if (!wa?.enabled) return '';
  const phone = (wa.phone || '').trim().replace(/^\+/, '');
  if (!phone) return '';
  return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`;
}

export function getDeliveryOptions(): DeliveryOption[] {
  return (siteData.delivery?.options ?? []) as DeliveryOption[];
}

export function getDeliveryConditions(): string[] {
  return (siteData.delivery?.conditions ?? []) as string[];
}

export function getTrustStrip(): string[] {
  return ((siteData.trustStrip ?? []) as string[]).filter((s) => Boolean(s && s.trim()));
}

export function getCategoryBySlug(slug: string): CategoryInfo | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getGroupedModels(categorySlug?: string): ProductModelGroup[] {
  const filtered = categorySlug
    ? ALL_PRODUCTS.filter((p) => p.category === categorySlug)
    : ALL_PRODUCTS;

  const map = new Map<string, ProductItem[]>();
  for (const item of filtered) {
    const list = map.get(item.modelSlug) || [];
    list.push(item);
    map.set(item.modelSlug, list);
  }

  const groups: ProductModelGroup[] = [];
  for (const [modelSlug, items] of map.entries()) {
    const first = items[0];
    const catInfo = getCategoryBySlug(first.category);
    const prices = items.map((i) => i.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Prefer Glacier render as hero card thumbnail for iPhone 18 Pro if present
    const preferred =
      items.find((i) => i.color === 'Glacier' && i.imageKey) ||
      items.find((i) => i.imageKey) ||
      first;

    const storages = Array.from(new Set(items.map((i) => i.storage).filter(Boolean))) as string[];
    const sims = Array.from(new Set(items.map((i) => i.sim).filter(Boolean))) as string[];

    const colorMap = new Map<string, { name: string; nameRu: string | null; hex: string; imageKey: string | null }>();
    for (const i of items) {
      if (i.color && !colorMap.has(i.color)) {
        colorMap.set(i.color, {
          name: i.color,
          nameRu: i.colorRu,
          hex: i.colorHex || '#888888',
          imageKey: i.imageKey,
        });
      }
    }

    groups.push({
      modelSlug,
      modelTitle: first.modelTitle,
      category: first.category,
      categoryTitle: catInfo?.title || first.category,
      url: `/catalog/${first.category}/${modelSlug}/`,
      minPrice,
      maxPrice,
      hasMultipleConfigs: items.length > 1,
      configCount: items.length,
      defaultImageKey: preferred.imageKey,
      isTemporaryPhoto: items.some((i) => i.isTemporaryPhoto),
      inStock: items.some((i) => i.inStock),
      storages,
      colors: Array.from(colorMap.values()),
      sims,
      items,
    });
  }

  // Ensure flagship order: iPhone 18 Pro first, followed by iPhone 17 family, MacBook, etc.
  const priorityOrder = [
    'iphone-18-pro',
    'iphone-17-pro-max',
    'iphone-17-pro',
    'iphone-17-air',
    'iphone-17',
    'iphone-16-pro',
    'macbook-air-13-m5',
    'macbook-neo-13-a16',
    'sony-playstation-5-slim',
    'samsung-a57-5g',
    'samsung-galaxy-watch-8-ultra',
  ];

  groups.sort((a, b) => {
    const ia = priorityOrder.indexOf(a.modelSlug);
    const ib = priorityOrder.indexOf(b.modelSlug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return groups;
}

/**
 * Verified Yandex Maps organization data (rating + review count, see site.json -> contacts.yandexOrg).
 * The org URL is owner-supplied config: while it holds the `[YANDEX_ORG_URL]` placeholder,
 * nothing that links to it is rendered (never render bracketed placeholders), and the map
 * links fall back to their previous behavior.
 */
export function isConfiguredUrl(url: string | null | undefined): boolean {
  return Boolean(url && /^https:\/\//.test(url) && !url.includes('['));
}

export function getYandexOrgLink(): string | null {
  const org = siteData.contacts.yandexOrg;
  return isConfiguredUrl(org?.url) ? (org.url as string) : null;
}

/** Russian plural for review counts: 51 отзыв, 2 отзыва, 55 отзывов. */
export function pluralReviews(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'отзыв';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'отзыва';
  return 'отзывов';
}
