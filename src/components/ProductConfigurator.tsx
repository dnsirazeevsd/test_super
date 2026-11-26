import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ImageAsset, ProductItem } from '../lib/catalog';
import { MESSENGER_PATHS, type MessengerName } from '../lib/messenger-icons';
import { trackGoal } from '../lib/analytics';
import { useConfiguratorMotion } from '../lib/useConfiguratorMotion';

/** Monochrome 18×18 messenger glyph, colored via currentColor. */
function MessengerGlyph({ name }: { name: MessengerName }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={MESSENGER_PATHS[name]} fillRule="evenodd" />
    </svg>
  );
}

interface Props {
  modelTitle: string;
  items: ProductItem[];
  manifest: Record<string, ImageAsset>;
  primaryPhoneDisplay: string;
  primaryPhoneHref: string;
  viberHref: string;
  telegramHref: string;
  giftNote: string;
}

function fmtPrice(p: number) {
  return `${p.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')}\u00A0₽`;
}

function colorSlug(c: string | null) {
  return c ? c.toLowerCase().replace(/\s+/g, '-') : '';
}

export default function ProductConfigurator({
  modelTitle,
  items,
  manifest,
  primaryPhoneDisplay,
  primaryPhoneHref,
  viberHref,
  telegramHref,
  giftNote,
}: Props) {
  // Default to the base (cheapest) configuration; prefer Glacier when tied,
  // so the flagship render leads on the 18 Pro.
  const initialIndex = useMemo(() => {
    const minPrice = Math.min(...items.map((i) => i.price));
    const cheapest = items.filter((i) => i.price === minPrice);
    const idx = cheapest.findIndex((i) => i.color === 'Glacier');
    return items.indexOf(idx >= 0 ? cheapest[idx] : cheapest[0]);
  }, [items]);

  const [selectedId, setSelectedId] = useState<string>(items[initialIndex].id);
  const { imageRef, priceRef, prepareChange } = useConfiguratorMotion(selectedId);
  const [copied, setCopied] = useState(false);
  const [simTipOpen, setSimTipOpen] = useState(false);
  const [openFacts, setOpenFacts] = useState<Record<string, boolean>>({});

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

  const sims = useMemo(() => {
    const set = new Set(items.map((i) => i.simSlug).filter(Boolean) as string[]);
    const res: Array<{ slug: string; label: string }> = [];
    if (set.has('sim-esim')) res.push({ slug: 'sim-esim', label: 'SIM + eSIM' });
    if (set.has('esim')) res.push({ slug: 'esim', label: 'eSIM' });
    return res;
  }, [items]);

  const selectStorage = (st: string) => {
    const exact = items.find(
      (i) => i.storage === st && i.color === current.color && i.simSlug === current.simSlug
    );
    const sameColor = items.find((i) => i.storage === st && i.color === current.color);
    const anyMatch = items.find((i) => i.storage === st);
    const target = exact || sameColor || anyMatch;
    if (target && target.id !== selectedId) { prepareChange(); setSelectedId(target.id); }
  };

  const selectColor = (col: string) => {
    const exact = items.find(
      (i) => i.color === col && i.storage === current.storage && i.simSlug === current.simSlug
    );
    const sameStorage = items.find((i) => i.color === col && i.storage === current.storage);
    const anyMatch = items.find((i) => i.color === col);
    const target = exact || sameStorage || anyMatch;
    if (target && target.id !== selectedId) { prepareChange(); setSelectedId(target.id); }
  };

  const selectSim = (smSlug: string) => {
    const exact = items.find(
      (i) => i.simSlug === smSlug && i.storage === current.storage && i.color === current.color
    );
    const sameStorage = items.find((i) => i.simSlug === smSlug && i.storage === current.storage);
    const anyMatch = items.find((i) => i.simSlug === smSlug);
    const target = exact || sameStorage || anyMatch;
    if (target && target.id !== selectedId) { prepareChange(); setSelectedId(target.id); }
  };

  const asset = current.imageKey ? manifest[current.imageKey] : null;
  const assetF7 = current.imageKey ? manifest[`${current.imageKey}-f7`] || asset : null;

  const copyShareUrl = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {}
  };

  const whatsappText = `Здравствуйте! Хочу уточнить наличие и актуальную цену в SUPER STORE (ТРЦ «РИО»): ${current.title} — ${fmtPrice(current.price)}.`;
  const whatsappHref = `https://api.whatsapp.com/send?phone=79312020078&text=${encodeURIComponent(whatsappText)}`;

  const toggleFact = (key: string) => {
    setOpenFacts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Accordion holds ONLY facts that exist in the source data
  const facts = [
    {
      id: 'warranty',
      question: 'Гарантия',
      answer:
        'Продаётся только оригинальная техника с гарантией магазина — как новые запечатанные устройства, так и проверенная Б/У техника. Проверка проводится прямо при вас.',
    },
    {
      id: 'gift',
      question: 'Подарок при покупке',
      answer: giftNote,
    },
    {
      id: 'payment',
      question: 'Способы оплаты',
      answer: 'Наличный расчёт, оплата по QR, оплата по банковской карте, кредитование.',
    },
    {
      id: 'pickup',
      question: 'Самовывоз из магазина',
      answer:
        'Приезжайте в ТРЦ «РИО» по адресу: Санкт-Петербург, улица Фучика, д. 2. Работаем ежедневно с 10:00 до 22:00 — осмотрите устройство до оплаты.',
    },
  ];

  return (
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
      {/* Left — large image on uniform #F7F7F9, no inner rectangle, no magnifier */}
      <div class="lg:col-span-6 lg:sticky lg:top-24">
        <div
          ref={imageRef}
          class="config-image aspect-[4/5] flex items-center justify-center overflow-hidden"
          style="background-color: var(--surface);"
        >
          {assetF7 || asset ? (
            <picture class="w-full h-full flex items-center justify-center">
              <source
                type="image/avif"
                srcset={(assetF7 || asset)!.avifSrcset}
                sizes="(max-width: 1024px) 92vw, 520px"
              />
              <source
                type="image/webp"
                srcset={(assetF7 || asset)!.webpSrcset}
                sizes="(max-width: 1024px) 92vw, 520px"
              />
              <img
                src={(assetF7 || asset)!.src}
                alt={current.title}
                width={(assetF7 || asset)!.width}
                height={(assetF7 || asset)!.height}
                loading="eager"
                fetchpriority="high"
                decoding="sync"
                class="max-h-[86%] w-auto object-contain"
              />
            </picture>
          ) : (
            <div class="flex flex-col items-center justify-center text-center p-8 text-fg-muted">
              <svg class="w-14 h-14 mb-3 opacity-35" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                <rect x="13" y="5" width="22" height="38" rx="4.5" />
                <circle cx="19" cy="11" r="1.5" fill="currentColor" />
                <circle cx="19" cy="16" r="1.5" fill="currentColor" />
              </svg>
              <p class="type-small font-semibold text-fg m-0">Фотография данной модели обновляется</p>
              <p class="type-small mt-1 mb-0 max-w-[30ch]">
                Напишите нам в WhatsApp — менеджер пришлёт живое фото из магазина.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right — configuration directly on the page background, thin 1px dividers */}
      <div class="lg:col-span-6">
        {/* One status line */}
        <p class="type-small text-fg-muted m-0">В наличии в СПб</p>

        {/* Clean model name as H1; full configuration stays in title/meta/JSON-LD */}
        <h1 class="type-display !text-[2.25rem] lg:!text-[3rem] mt-2 mb-0">{modelTitle}</h1>

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

        {/* Pill selectors — SIM with (?) tooltip */}
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

        {/* One filled button + text links (phone never wraps) */}
        <div class="pt-8 mt-8 space-y-4" style="border-top: 1px solid var(--divider);">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            data-goal="click_check_stock"
            onClick={() =>
              trackGoal('click_check_stock', { item: current.title, price: current.price })
            }
            class="btn w-full sm:w-auto"
          >
            Узнать наличие в WhatsApp
          </a>

          {/* Messengers: icon + text links, wrap cleanly on narrow screens */}
          <div class="flex flex-wrap items-center gap-x-7 gap-y-3 pt-2">
            <a
              href={`${telegramHref}?text=${encodeURIComponent(whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              data-goal="click_telegram"
              class="inline-flex items-center gap-2 font-semibold text-fg hover:text-brand transition-colors"
            >
              <MessengerGlyph name="telegram" />
              Telegram
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-goal="click_whatsapp"
              class="inline-flex items-center gap-2 font-semibold text-fg hover:text-brand transition-colors"
            >
              <MessengerGlyph name="whatsapp" />
              WhatsApp
            </a>
            <a
              href={viberHref}
              data-goal="click_viber"
              class="inline-flex items-center gap-2 font-semibold text-fg hover:text-brand transition-colors"
            >
              <MessengerGlyph name="viber" />
              Viber
            </a>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
            <a
              href={primaryPhoneHref}
              data-goal="click_phone"
              class="arrow-link tabular-nums whitespace-nowrap self-start"
            >
              Позвонить · {primaryPhoneDisplay}
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </a>
          </div>
        </div>

        {/* One accordion with source facts only */}
        <div class="mt-12" style="border-top: 1px solid var(--divider);">
          {facts.map((fact) => (
            <div style="border-bottom: 1px solid var(--divider);">
              <button
                type="button"
                onClick={() => toggleFact(fact.id)}
                aria-expanded={Boolean(openFacts[fact.id])}
                class="w-full flex items-center justify-between gap-4 py-5 text-left font-semibold text-fg bg-transparent p-0"
              >
                <span>{fact.question}</span>
                <svg
                  class={`w-4 h-4 shrink-0 text-fg-muted transition-transform ${openFacts[fact.id] ? 'rotate-45' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" stroke-linecap="round" />
                </svg>
              </button>
              {openFacts[fact.id] && (
                <p class="type-body text-fg-muted pb-6 mt-0 mb-0">{fact.answer}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
