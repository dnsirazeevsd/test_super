import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type {
  DeliveryOption,
  ImageAsset,
  ProductItem,
  ProductSpecGroup,
} from '../lib/catalog';
import { buildSummary } from '../lib/specs.mjs';
import { MESSENGER_PATHS, type MessengerName } from '../lib/messenger-icons';
import { openLeadModal, type LeadModalPayload } from '../lib/lead';
import { simpleMotion } from '../lib/motion';
import { useConfiguratorMotion } from '../lib/useConfiguratorMotion';

/** Monochrome 18×18 messenger glyph, colored via currentColor. */
function MessengerGlyph({ name }: { name: MessengerName }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={MESSENGER_PATHS[name]} fillRule="evenodd" />
    </svg>
  );
}

interface GalleryEntry {
  key: string;
  asset: ImageAsset;
  surfaceAsset: ImageAsset;
  label: string;
  color: string | null;
}

interface Props {
  modelTitle: string;
  favId: string;
  items: ProductItem[];
  category: string;
  specGroups: ProductSpecGroup[];
  manifest: Record<string, ImageAsset>;
  primaryPhoneDisplay: string;
  primaryPhoneHref: string;
  whatsappEnabled: boolean;
  whatsappHref: string;
  telegramEnabled: boolean;
  telegramHref: string;
  telegramUsername: string;
  giftDescription: string;
  deliveryOptions: DeliveryOption[];
  deliveryConditions: string[];
  trustStrip: string[];
  warrantyText?: string;
}

function fmtPrice(p: number) {
  return `${p.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')}\u00A0₽`;
}

function colorSlug(c: string | null) {
  return c ? c.toLowerCase().replace(/\s+/g, '-') : '';
}

/**
 * Expand `colorVariants` — several colors stored on ONE product record (no
 * extra SKUs) — into per-color entries with the exact shape separate color
 * variants already use (color / colorRu / colorHex / imageKey). Everything
 * downstream (color pills, gallery, spec summary, booking payload, URL params)
 * then behaves identically to existing multi-SKU color models.
 * Items without colorVariants are returned as-is (same array reference), so
 * hooks and memos stay stable for every other product.
 */
function expandColorVariants(list: ProductItem[]): ProductItem[] {
  if (!list.some((i) => (i.colorVariants?.length ?? 0) > 1)) return list;
  const out: ProductItem[] = [];
  for (const item of list) {
    const variants = item.colorVariants;
    if (!variants || variants.length <= 1) {
      out.push(item);
      continue;
    }
    for (const v of variants) {
      out.push({
        ...item,
        // Runtime-only handle for state tracking; never persisted anywhere.
        id: `${item.id}::${v.color.toLowerCase().replace(/\s+/g, '-')}`,
        color: v.color,
        colorRu: v.colorRu,
        colorHex: v.colorHex,
        imageKey: v.imageKey ?? item.imageKey,
      });
    }
  }
  return out;
}

export default function ProductConfigurator({
  modelTitle,
  favId,
  items: rawItems,
  category,
  specGroups,
  manifest,
  primaryPhoneDisplay,
  primaryPhoneHref,
  whatsappEnabled,
  whatsappHref,
  telegramEnabled,
  telegramHref,
  telegramUsername,
  giftDescription,
  deliveryOptions,
  deliveryConditions,
  trustStrip,
  warrantyText = '',
}: Props) {
  // One-record color variants (e.g. AirPods Max 2) expand to per-color entries;
  // every other product keeps the exact same items array (same reference).
  const items = useMemo(() => expandColorVariants(rawItems), [rawItems]);
  // Default to the base (cheapest) configuration; prefer Glacier when tied,
  // so the flagship render leads on the 18 Pro.
  const initialIndex = useMemo(() => {
    const minPrice = Math.min(...items.map((i) => i.price));
    const cheapest = items.filter((i) => i.price === minPrice);
    const idx = cheapest.findIndex((i) => i.color === 'Glacier');
    return items.indexOf(idx >= 0 ? cheapest[idx] : cheapest[0]);
  }, [items]);

  const [selectedId, setSelectedId] = useState<string>(items[initialIndex].id);
  const [customImageKey, setCustomImageKey] = useState<string | null>(null);
  const [lightboxClosing, setLightboxClosing] = useState(false);
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);

  const motionKey = `${selectedId}:${customImageKey || ''}`;
  const { imageRef, priceRef, prepareChange } = useConfiguratorMotion(motionKey);
  const [copied, setCopied] = useState(false);
  const [simTipOpen, setSimTipOpen] = useState(false);
  const [openFacts, setOpenFacts] = useState<Record<string, boolean>>({});

  // Expandable full-specifications panel (compact summary is always visible).
  const [specsOpen, setSpecsOpen] = useState(false);

  // Read URL params on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const st = params.get('storage');
    const col = params.get('color');
    const sm = params.get('sim');
    if (!st && !col && !sm) return;

    const match = items.find((i) => {
      const okSt = !st || i.storageSlug === st;
      const okCol = !col || colorSlug(i.color) === col;
      const okSim = !sm || i.simSlug === sm;
      return okSt && okCol && okSim;
    });
    if (match) setSelectedId(match.id);
  }, [items]);

  const current = useMemo(
    () => items.find((i) => i.id === selectedId) || items[0],
    [items, selectedId]
  );

  // Compact summary reflects the *currently selected* configuration, so it
  // updates instantly when the user switches storage / colour / SIM — no reload.
  const summary = useMemo(
    () => buildSummary(category, current, specGroups),
    [category, current, specGroups]
  );

  // Sync URL query params whenever configuration changes
  useEffect(() => {
    if (typeof window === 'undefined' || items.length <= 1) return;
    const params = new URLSearchParams();
    if (current.storageSlug) params.set('storage', current.storageSlug);
    if (current.color) params.set('color', colorSlug(current.color));
    if (current.simSlug) params.set('sim', current.simSlug);
    const qs = params.toString();
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [current, items.length]);

  const currentLeadPayload = useMemo<LeadModalPayload>(() => {
    const colorDisplay = current.color
      ? current.colorRu && current.colorRu !== current.color
        ? `${current.color} (${current.colorRu})`
        : current.color
      : null;
    return {
      type: 'reserve',
      model: modelTitle,
      title: current.title,
      color: colorDisplay,
      storage: current.storage,
      sim: current.sim,
      price: current.price,
    };
  }, [current, modelTitle]);

  // Share active configuration with MobileStickyBar "Забронировать"
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__SUPERSTORE_CURRENT_PRODUCT__ = currentLeadPayload;
    return () => {
      window.__SUPERSTORE_CURRENT_PRODUCT__ = null;
    };
  }, [currentLeadPayload]);

  // Gallery entries: per-SKU images[] if multiple exist, else unique product images across colors
  const galleryEntries = useMemo<GalleryEntry[]>(() => {
    if (current.images && current.images.length > 1) {
      const list: GalleryEntry[] = [];
      for (const key of current.images) {
        const base = manifest[key];
        const surf = manifest[`${key}-f7`] || base;
        if (base && surf) {
          list.push({
            key,
            asset: base,
            surfaceAsset: surf,
            label: current.title,
            color: current.color,
          });
        }
      }
      if (list.length > 0) return list;
    }

    const map = new Map<string, GalleryEntry>();
    // Seed with initial configuration first so Glacier leads on iPhone 18 Pro
    const ordered = [items[initialIndex], ...items];
    for (const it of ordered) {
      if (!it.imageKey || map.has(it.imageKey)) continue;
      const base = manifest[it.imageKey];
      const surf = manifest[`${it.imageKey}-f7`] || base;
      if (!base || !surf) continue;
      map.set(it.imageKey, {
        key: it.imageKey,
        asset: base,
        surfaceAsset: surf,
        label: it.color ? `${modelTitle} — ${it.color}` : it.title,
        color: it.color,
      });
    }
    return Array.from(map.values());
  }, [current.images, current.title, current.color, items, initialIndex, manifest, modelTitle]);

  const activeImageKey = customImageKey || current.imageKey;
  const activeGalleryIdx = useMemo(() => {
    if (!activeImageKey) return 0;
    const idx = galleryEntries.findIndex((g) => g.key === activeImageKey);
    return idx >= 0 ? idx : 0;
  }, [galleryEntries, activeImageKey]);

  const activeEntry = galleryEntries[activeGalleryIdx] || null;
  const fallbackAsset = current.imageKey ? manifest[current.imageKey] : null;
  const displaySurfaceAsset =
    activeEntry?.surfaceAsset ||
    (current.imageKey ? manifest[`${current.imageKey}-f7`] || fallbackAsset : null);
  const displayLightboxAsset = activeEntry?.asset || displaySurfaceAsset;
  const hasMultipleImages = galleryEntries.length > 1;

  const storages = useMemo(() => {
    const order = ['128 GB', '256 GB', '512 GB', '1 TB', '2 TB', '8/128 GB', '8/256 GB', '16/1 TB'];
    const set = new Set(items.map((i) => i.storage).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [items]);

  const colors = useMemo(() => {
    const map = new Map<string, { name: string; nameRu: string | null; hex: string }>();
    for (const i of items) {
      if (i.color && !map.has(i.color)) {
        map.set(i.color, {
          name: i.color,
          nameRu: i.colorRu,
          hex: i.colorHex || '#888888',
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  // Build SIM options strictly from the product data ("SIM + eSIM" / "eSIM")
  const sims = useMemo(() => {
    const map = new Map<string, string>();
    // First pass: canonical single-mode SIM values from data
    for (const i of items) {
      if (i.simSlug && i.sim && !i.sim.includes('/') && !map.has(i.simSlug)) {
        map.set(i.simSlug, i.sim);
      }
    }
    // Second pass: include any remaining data values without inventing labels
    for (const i of items) {
      if (i.simSlug && i.sim && !map.has(i.simSlug)) {
        map.set(i.simSlug, i.sim);
      }
    }
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [items]);

  const selectStorage = (st: string) => {
    const exact = items.find(
      (i) => i.storage === st && i.color === current.color && i.simSlug === current.simSlug
    );
    const sameColor = items.find((i) => i.storage === st && i.color === current.color);
    const anyMatch = items.find((i) => i.storage === st);
    const target = exact || sameColor || anyMatch;
    if (target && target.id !== selectedId) {
      prepareChange();
      setCustomImageKey(null);
      setSelectedId(target.id);
    }
  };

  const selectColor = (col: string) => {
    const exact = items.find(
      (i) => i.color === col && i.storage === current.storage && i.simSlug === current.simSlug
    );
    const sameStorage = items.find((i) => i.color === col && i.storage === current.storage);
    const anyMatch = items.find((i) => i.color === col);
    const target = exact || sameStorage || anyMatch;
    if (target && target.id !== selectedId) {
      prepareChange();
      setCustomImageKey(null);
      setSelectedId(target.id);
    }
  };

  const selectSim = (smSlug: string) => {
    const exact = items.find(
      (i) => i.simSlug === smSlug && i.storage === current.storage && i.color === current.color
    );
    const sameStorage = items.find((i) => i.simSlug === smSlug && i.storage === current.storage);
    const anyMatch = items.find((i) => i.simSlug === smSlug);
    const target = exact || sameStorage || anyMatch;
    if (target && target.id !== selectedId) {
      prepareChange();
      setCustomImageKey(null);
      setSelectedId(target.id);
    }
  };

  const selectGalleryIndex = (nextIdx: number) => {
    if (galleryEntries.length === 0) return;
    const bounded = ((nextIdx % galleryEntries.length) + galleryEntries.length) % galleryEntries.length;
    const targetEntry = galleryEntries[bounded];
    if (!targetEntry) return;
    if (targetEntry.color && targetEntry.color !== current.color) {
      selectColor(targetEntry.color);
    } else if (targetEntry.key !== activeImageKey) {
      prepareChange();
      setCustomImageKey(targetEntry.key);
    }
  };

  const openLightbox = (triggerEl: HTMLElement) => {
    const dlg = lightboxRef.current;
    if (!dlg || !displayLightboxAsset) return;
    lightboxTriggerRef.current = triggerEl;
    setLightboxClosing(false);
    if (!dlg.open) dlg.showModal();
  };

  const closeLightbox = () => {
    const dlg = lightboxRef.current;
    if (!dlg || !dlg.open || lightboxClosing) return;
    if (simpleMotion()) {
      dlg.close();
      lightboxTriggerRef.current?.focus();
      return;
    }
    setLightboxClosing(true);
    window.setTimeout(() => {
      setLightboxClosing(false);
      if (dlg.open) dlg.close();
      lightboxTriggerRef.current?.focus();
    }, 150);
  };

  const copyShareUrl = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {}
  };

  const toggleFact = (key: string) => {
    setOpenFacts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const trimmedDescription = (current.description || '').trim();
  const trimmedGiftDescription = (giftDescription || '').trim();
  const trimmedWarranty = (warrantyText || '').trim();
  const showTelegram = telegramEnabled && Boolean(telegramHref);
  const showWhatsApp = whatsappEnabled && Boolean(whatsappHref);

  // Prefilled messenger text with the exact configuration, e.g.:
  // "Здравствуйте! Интересует iPhone 18 Pro, Glacier, 256 GB, SIM + eSIM. Есть в наличии?"
  const messengerText = useMemo(() => {
    const colorDisplay = current.color
      ? current.colorRu && current.colorRu !== current.color
        ? `${current.color} (${current.colorRu})`
        : current.color
      : null;
    const parts = [modelTitle];
    if (colorDisplay) parts.push(colorDisplay);
    if (current.storage) parts.push(current.storage);
    if (current.sim) parts.push(current.sim);
    return `Здравствуйте! Интересует ${parts.join(', ')}. Есть в наличии?`;
  }, [current, modelTitle]);

  // WhatsApp always carries the prefilled text; Telegram carries it only when a
  // username is set (the phone-only t.me link never gets a ?text= parameter).
  const whatsappMessengerHref = showWhatsApp
    ? `${whatsappHref}?text=${encodeURIComponent(messengerText)}`
    : '';
  const telegramMessengerHref = showTelegram
    ? (telegramUsername.trim() ? `${telegramHref}?text=${encodeURIComponent(messengerText)}` : telegramHref)
    : '';

  return (
    <div
      class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start"
      data-product-configurator
    >
      {/* Left — uniform #F7F7F9 gallery, no inner box; arrows & thumbnails ONLY when >1 image */}
      <div class="lg:col-span-6 lg:sticky lg:top-24">
        <div
          ref={imageRef}
          class="config-image aspect-[4/5] flex items-center justify-center overflow-hidden"
          style="background-color: var(--surface);"
        >
          {displaySurfaceAsset ? (
            <>
              <picture class="w-full h-full flex items-center justify-center">
                {displaySurfaceAsset.avifSrcset && (
                  <source
                    type="image/avif"
                    srcset={displaySurfaceAsset.avifSrcset}
                    sizes="(max-width: 1024px) 92vw, 520px"
                  />
                )}
                {displaySurfaceAsset.webpSrcset && (
                  <source
                    type="image/webp"
                    srcset={displaySurfaceAsset.webpSrcset}
                    sizes="(max-width: 1024px) 92vw, 520px"
                  />
                )}
                <img
                  src={displaySurfaceAsset.src}
                  alt={activeEntry?.label || current.title}
                  width={displaySurfaceAsset.width}
                  height={displaySurfaceAsset.height}
                  loading="eager"
                  fetchpriority="high"
                  decoding="async"
                  class="max-h-[86%] w-auto object-contain"
                />
              </picture>
              <button
                type="button"
                onClick={(e) => openLightbox(e.currentTarget)}
                aria-label="Открыть изображение в полном размере"
                class="absolute inset-0 z-[5] w-full h-full bg-transparent cursor-zoom-in p-0"
              />
              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    onClick={() => selectGalleryIndex(activeGalleryIdx - 1)}
                    aria-label="Предыдущее фото"
                    class="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center text-fg-muted hover:text-fg bg-transparent p-0"
                  >
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectGalleryIndex(activeGalleryIdx + 1)}
                    aria-label="Следующее фото"
                    class="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center text-fg-muted hover:text-fg bg-transparent p-0"
                  >
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </>
              )}
            </>
          ) : (
            <div class="flex flex-col items-center justify-center text-center p-8 text-fg-muted">
              <p class="type-small text-fg-muted m-0">Фото уточняется у менеджера</p>
            </div>
          )}
        </div>

        {/* Thumbnail strip ONLY when >1 image, uniform #F7F7F9 background, zero inner borders */}
        {hasMultipleImages && (
          <div
            class="config-thumbs mt-3 grid grid-cols-4 sm:grid-cols-5 gap-2.5"
            role="group"
            aria-label="Миниатюры галереи"
          >
            {galleryEntries.map((entry, idx) => {
              const active = idx === activeGalleryIdx;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => selectGalleryIndex(idx)}
                  aria-label={entry.label}
                  aria-pressed={active}
                  class={`aspect-square flex items-center justify-center overflow-hidden p-2 transition-opacity ${
                    active ? 'opacity-100' : 'opacity-55 hover:opacity-90'
                  }`}
                  style={
                    active
                      ? 'background-color: var(--surface); border-bottom: 2px solid var(--text);'
                      : 'background-color: var(--surface); border-bottom: 2px solid transparent;'
                  }
                >
                  <picture>
                    <source
                      type="image/avif"
                      srcSet={entry.surfaceAsset.avifSrcset}
                      sizes="(max-width: 1024px) 22vw, 120px"
                    />
                    <source
                      type="image/webp"
                      srcSet={entry.surfaceAsset.webpSrcset}
                      sizes="(max-width: 1024px) 22vw, 120px"
                    />
                    <img
                      src={entry.surfaceAsset.src}
                      alt=""
                      width={entry.surfaceAsset.width}
                      height={entry.surfaceAsset.height}
                      loading="lazy"
                      class="max-h-full w-auto object-contain"
                    />
                  </picture>
                </button>
              );
            })}
          </div>
        )}

        {/* Native <dialog> lightbox */}
        <dialog
          ref={lightboxRef}
          class={`modal-dialog fixed inset-0 z-[110] m-0 w-full h-full ${lightboxClosing ? 'is-closing' : ''}`}
          aria-label={`Просмотр фото: ${modelTitle}`}
          onCancel={(e) => {
            e.preventDefault();
            closeLightbox();
          }}
          onClick={(e) => {
            if (e.target === lightboxRef.current || (e.target as HTMLElement).hasAttribute('data-lightbox-backdrop')) {
              closeLightbox();
            }
          }}
          onKeyDown={(e) => {
            if (hasMultipleImages && e.key === 'ArrowLeft') {
              e.preventDefault();
              selectGalleryIndex(activeGalleryIdx - 1);
            } else if (hasMultipleImages && e.key === 'ArrowRight') {
              e.preventDefault();
              selectGalleryIndex(activeGalleryIdx + 1);
            }
          }}
        >
          <div
            class="w-full h-full flex items-center justify-center p-4 sm:p-10"
            data-lightbox-backdrop
          >
            <div
              class="modal-panel relative w-full max-w-3xl aspect-[4/5] max-h-[88vh] flex items-center justify-center p-6 sm:p-10"
              style="background-color: var(--surface);"
            >
              <button
                type="button"
                onClick={closeLightbox}
                aria-label="Закрыть просмотр фото"
                class="absolute top-4 right-4 z-10 p-2 text-fg-muted hover:text-fg bg-transparent"
              >
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" />
                </svg>
              </button>
              {displayLightboxAsset && (
                <img
                  src={displayLightboxAsset.src}
                  alt={activeEntry?.label || current.title}
                  width={displayLightboxAsset.width}
                  height={displayLightboxAsset.height}
                  loading="lazy"
                  class="max-h-full max-w-full w-auto h-auto object-contain"
                />
              )}
              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    onClick={() => selectGalleryIndex(activeGalleryIdx - 1)}
                    aria-label="Предыдущее фото"
                    class="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-fg-muted hover:text-fg bg-transparent"
                  >
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectGalleryIndex(activeGalleryIdx + 1)}
                    aria-label="Следующее фото"
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-fg-muted hover:text-fg bg-transparent"
                  >
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </dialog>
      </div>

      {/* Right — configuration directly on the page background, thin 1px dividers */}
      <div class="lg:col-span-6">
        {/* Stock status: green dot #1A7F4B + "В наличии • ТРЦ «РИО»", or neutral "Под заказ" */}
        {current.inStock ? (
          <p class="status-badge status-badge--in m-0">
            <span class="status-dot" aria-hidden="true"></span>
            <span>В наличии • ТРЦ «РИО»</span>
          </p>
        ) : (
          <p class="type-small text-fg-muted m-0">Под заказ</p>
        )}

        {/* Clean model name as H1; full configuration stays in title/meta/JSON-LD */}
        <div class="flex items-start gap-3">
          <h1 class="type-display !text-[2.25rem] lg:!text-[3rem] mt-2 mb-0">{modelTitle}</h1>
          <button
            type="button"
            data-fav-btn
            data-fav-id={favId}
            aria-pressed="false"
            aria-label="Добавить в избранное"
            class="fav-heart mt-3 shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>

        {/* Large price + compact share icon */}
        <div class="flex items-center justify-between gap-4 mt-6">
          <p ref={priceRef} class="config-price text-4xl lg:text-5xl font-semibold tracking-tight tabular-nums m-0" aria-live="polite" aria-atomic="true">
            <span>{fmtPrice(current.price)}</span>
          </p>
          {items.length > 1 && (
            <button
              type="button"
              onClick={copyShareUrl}
              aria-label="Скопировать ссылку на выбранную конфигурацию"
              title={copied ? 'Ссылка скопирована' : 'Поделиться конфигурацией'}
              class="relative p-2 text-fg-muted hover:text-brand transition-colors"
            >
              {copied ? (
                <svg class="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              ) : (
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" stroke-linecap="round" />
                  <path d="M16 6l-4-4-4 4" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M12 2v13" stroke-linecap="round" />
                </svg>
              )}
              {copied && (
                <span
                  role="status"
                  class="absolute -top-9 right-0 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white rounded-lg"
                  style="background-color: var(--text);"
                >
                  Ссылка скопирована
                </span>
              )}
            </button>
          )}
        </div>

        {/* Plain gift line under price; giftDescription rendered ONLY when filled in site.json */}
        <div class="mt-3">
          <p class="type-small text-fg m-0">Подарок при покупке</p>
          {trimmedGiftDescription && (
            <p class="type-small text-fg-muted mt-1 mb-0">{trimmedGiftDescription}</p>
          )}
        </div>

        {current.note && (
          <p class="type-small text-fg-muted mt-4 mb-0">{current.note}</p>
        )}

        {/* Pill selectors — memory */}
        {storages.length > 1 && (
          <div class="pt-6 mt-8" style="border-top: 1px solid var(--divider);">
            <div class="type-small font-semibold mb-3">
              Память: <span class="text-fg-muted font-normal">{current.storage}</span>
            </div>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Объём памяти">
              {storages.map((st) => {
                const active = current.storage === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => selectStorage(st)}
                    aria-pressed={active}
                    class={`px-4 py-2 text-sm font-semibold tabular-nums transition-colors ${
                      active ? 'text-white' : 'text-fg'
                    }`}
                    style={
                      active
                        ? 'background-color: var(--text); border-radius: 999px;'
                        : 'border: 1px solid var(--divider); border-radius: 999px; background: transparent;'
                    }
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pill selectors — color dots */}
        {colors.length > 1 && (
          <div class="pt-6 mt-6" style="border-top: 1px solid var(--divider);">
            <div class="type-small font-semibold mb-3">
              Цвет: <span class="text-fg-muted font-normal">{current.color}</span>
              {current.colorRu && current.colorRu !== current.color ? ` (${current.colorRu})` : ''}
            </div>
            <div class="flex flex-wrap gap-2.5" role="group" aria-label="Цвет">
              {colors.map((c) => {
                const active = current.color === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => selectColor(c.name)}
                    aria-pressed={active}
                    aria-label={c.name}
                    title={c.name}
                    class="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                  >
                    <span
                      class={`w-7 h-7 rounded-full ring-1 ring-black/15 ${
                        active ? 'ring-2 ring-brand ring-offset-2 ring-offset-white' : ''
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pill selectors — SIM from product data with (?) tooltip */}
        {sims.length > 1 && (
          <div class="pt-6 mt-6" style="border-top: 1px solid var(--divider);">
            <div class="type-small font-semibold mb-3 flex items-center gap-1.5">
              Версия SIM: <span class="text-fg-muted font-normal">{current.sim}</span>
              <span class="relative inline-flex">
                <button
                  type="button"
                  onClick={() => setSimTipOpen((v) => !v)}
                  onMouseEnter={() => setSimTipOpen(true)}
                  onMouseLeave={() => setSimTipOpen(false)}
                  onFocus={() => setSimTipOpen(true)}
                  onBlur={() => setSimTipOpen(false)}
                  aria-expanded={simTipOpen}
                  aria-label="Что такое версии SIM + eSIM и eSIM?"
                  class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold text-fg-muted hover:text-brand transition-colors"
                  style="border: 1px solid var(--divider);"
                >
                  ?
                </button>
                {simTipOpen && (
                  <span
                    role="tooltip"
                    class="absolute bottom-full left-0 mb-2 z-20 w-72 px-4 py-3 type-small text-white rounded-xl leading-relaxed"
                    style="background-color: var(--text);"
                  >
                    SIM + eSIM — слот для одной физической nano-SIM + электронная eSIM.
                    eSIM — без физической SIM, поддержка двух активных номеров.
                  </span>
                )}
              </span>
            </div>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Версия SIM">
              {sims.map((sm) => {
                const active = current.simSlug === sm.slug;
                return (
                  <button
                    key={sm.slug}
                    type="button"
                    onClick={() => selectSim(sm.slug)}
                    aria-pressed={active}
                    class={`px-4 py-2 text-sm font-semibold transition-colors ${
                      active ? 'text-white' : 'text-fg'
                    }`}
                    style={
                      active
                        ? 'background-color: var(--text); border-radius: 999px;'
                        : 'border: 1px solid var(--divider); border-radius: 999px; background: transparent;'
                    }
                  >
                    {sm.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary filled "Забронировать" + secondary text link ("Написать в Telegram" if enabled, else "Позвонить") */}
        <div class="pt-8 mt-8 space-y-5" style="border-top: 1px solid var(--divider);">
          <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
            <a
              href={primaryPhoneHref}
              onClick={(e) => {
                e.preventDefault();
                openLeadModal(currentLeadPayload, e.currentTarget);
              }}
              class="btn w-full sm:w-auto"
            >
              Забронировать
            </a>

            {showTelegram ? (
              <a
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                data-goal="click_telegram"
                class="arrow-link"
              >
                Написать в Telegram
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </a>
            ) : (
              <a
                href={primaryPhoneHref}
                data-goal="click_phone"
                class="arrow-link"
              >
                Позвонить
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </a>
            )}
          </div>

        <div class="flex flex-wrap items-center gap-x-7 gap-y-2 type-small">
          <a
            href={primaryPhoneHref}
            data-goal="click_phone"
            class="font-semibold tabular-nums whitespace-nowrap text-fg-muted hover:text-brand transition-colors no-underline"
          >
            {primaryPhoneDisplay}
          </a>
          {showTelegram && (
            <a
              href={telegramMessengerHref}
              target="_blank"
              rel="noopener noreferrer"
              data-goal="click_telegram"
              aria-label="Написать в Telegram"
              class="inline-flex items-center gap-1.5 font-semibold text-fg-muted hover:text-brand transition-colors no-underline min-h-[44px]"
            >
              <MessengerGlyph name="telegram" />
              Telegram
            </a>
          )}
          {showWhatsApp && (
            <a
              href={whatsappMessengerHref}
              target="_blank"
              rel="noopener noreferrer"
              data-goal="click_whatsapp"
              aria-label="Написать в WhatsApp"
              class="inline-flex items-center gap-1.5 font-semibold text-fg-muted hover:text-brand transition-colors no-underline min-h-[44px]"
            >
              <MessengerGlyph name="whatsapp" />
              WhatsApp
            </a>
          )}
        </div>
        </div>

        {/* Optional "Описание" — rendered ONLY when filled */}
        {trimmedDescription && (
          <div class="pt-8 mt-8 space-y-3" style="border-top: 1px solid var(--divider);">
            <h2 class="text-lg font-semibold text-fg m-0">Описание</h2>
            <p class="type-body text-fg-muted m-0">{trimmedDescription}</p>
          </div>
        )}

        {/* Specifications — always rendered: compact summary + expandable full specs.
            The full groups stay in the initial DOM (CSS-hidden when collapsed) so the
            content is crawlable and never removed on variant changes. */}
        <section
          class="pt-8 mt-8"
          style="border-top: 1px solid var(--divider);"
          aria-labelledby="specs-heading"
        >
          <h2 id="specs-heading" class="text-lg font-semibold text-fg m-0">
            Характеристики
          </h2>

          {/* Compact summary — the four key characteristics, category-adapted */}
          <dl class="m-0 mt-4" style="border-top: 1px solid var(--divider);">
            {summary.map((row) => (
              <div
                key={row.label}
                class="py-3 flex items-baseline justify-between gap-4 type-small"
                style="border-bottom: 1px solid var(--divider);"
              >
                <dt class="text-fg-muted">{row.label}</dt>
                <dd class="m-0 font-semibold text-brand text-right">{row.value}</dd>
              </div>
            ))}
          </dl>

          {/* Expandable full specifications — present in DOM, hidden via CSS when collapsed */}
          {specGroups.length > 0 && (
            <div
              id="specs-details"
              class={`specs-details mt-2 ${specsOpen ? 'is-open' : 'is-collapsed'}`}
            >
              {specGroups.map((g) => (
                <div
                  key={g.group}
                  class="specs-group pt-6 mt-6"
                  style="border-top: 1px solid var(--divider);"
                >
                  <h3 class="specs-group__title text-base font-semibold text-fg m-0">
                    {g.group}
                  </h3>
                  <dl class="specs-group__body m-0">
                    {g.items.map((it) => (
                      <div
                        key={it.label}
                        class="py-3 flex items-baseline justify-between gap-4 type-small"
                        style="border-bottom: 1px solid var(--divider);"
                      >
                        <dt class="text-fg-muted">{it.label}</dt>
                        <dd class="m-0 font-semibold text-brand text-right">{it.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}

          {/* Centered pill toggle — semantic, accessible expand/collapse */}
          {specGroups.length > 0 && (
            <div class="flex justify-center mt-6">
              <button
                type="button"
                class="specs-toggle"
                aria-expanded={specsOpen}
                aria-controls="specs-details"
                onClick={() => setSpecsOpen((v) => !v)}
              >
                {specsOpen ? 'Свернуть характеристики' : 'Показать все характеристики'}
              </button>
            </div>
          )}
        </section>

        {/* Accordion: "Доставка и получение" + optional "Гарантия" + data-driven Trust strip */}
        <div class="mt-10" style="border-top: 1px solid var(--divider);">
          {deliveryOptions.length > 0 && (
            <div style="border-bottom: 1px solid var(--divider);">
              <button
                type="button"
                onClick={() => toggleFact('delivery')}
                aria-expanded={Boolean(openFacts.delivery)}
                class="w-full flex items-center justify-between gap-4 py-5 text-left font-semibold text-fg bg-transparent p-0"
              >
                <span>Доставка и получение</span>
                <svg
                  class={`w-4 h-4 shrink-0 text-fg-muted transition-transform ${openFacts.delivery ? 'rotate-45' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" stroke-linecap="round" />
                </svg>
              </button>
              {openFacts.delivery && (
                <div class="pb-6 space-y-5">
                  <div class="space-y-3">
                    {deliveryOptions.map((opt) => (
                      <div
                        key={opt.id}
                        class="flex items-baseline justify-between gap-4 type-small pb-3"
                        style="border-bottom: 1px solid var(--divider);"
                      >
                        <div>
                          <div class="font-semibold text-fg">{opt.label}</div>
                          <div class="text-fg-muted">{opt.detail}</div>
                        </div>
                        <span class="font-semibold text-fg tabular-nums whitespace-nowrap">
                          {opt.priceLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                  {deliveryConditions.length > 0 && (
                    <ul class="space-y-1.5 list-none m-0 p-0">
                      {deliveryConditions.map((cond, idx) => (
                        <li key={idx} class="type-small text-fg-muted">
                          — {cond}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {trimmedWarranty && (
            <div style="border-bottom: 1px solid var(--divider);">
              <button
                type="button"
                onClick={() => toggleFact('warranty')}
                aria-expanded={Boolean(openFacts.warranty)}
                class="w-full flex items-center justify-between gap-4 py-5 text-left font-semibold text-fg bg-transparent p-0"
              >
                <span>Гарантия</span>
                <svg
                  class={`w-4 h-4 shrink-0 text-fg-muted transition-transform ${openFacts.warranty ? 'rotate-45' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" stroke-linecap="round" />
                </svg>
              </button>
              {openFacts.warranty && (
                <p class="type-body text-fg-muted pb-6 mt-0 mb-0">{trimmedWarranty}</p>
              )}
            </div>
          )}

          {trustStrip.length > 0 && (
            <div style="border-bottom: 1px solid var(--divider);">
              <button
                type="button"
                onClick={() => toggleFact('trust')}
                aria-expanded={openFacts.trust ?? true}
                class="w-full flex items-center justify-between gap-4 py-5 text-left font-semibold text-fg bg-transparent p-0"
              >
                <span>Условия покупки</span>
                <svg
                  class={`w-4 h-4 shrink-0 text-fg-muted transition-transform ${(openFacts.trust ?? true) ? 'rotate-45' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" stroke-linecap="round" />
                </svg>
              </button>
              {(openFacts.trust ?? true) && (
                <ul class="list-none m-0 p-0 pb-2">
                  {trustStrip.map((item, idx) => (
                    <li
                      key={idx}
                      class="py-2.5 type-small text-fg-muted"
                      style={idx > 0 ? 'border-top: 1px solid var(--divider);' : undefined}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
