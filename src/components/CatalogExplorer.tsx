import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CategoryInfo, ImageAsset, ProductItem } from '../lib/catalog';

// Russian search synonyms (translit/color/memory normalization) — moved here when the
// standalone SearchDialog component was removed.
const RU_SYNONYMS: Array<[RegExp, string]> = [
  [/айфон|ифон/gi, 'iphone'],
  [/макбук|мак/gi, 'macbook'],
  [/самсунг/gi, 'samsung'],
  [/плейстейшен|плойка|пс5|сони/gi, 'playstation sony ps5'],
  [/часы|вотч/gi, 'watch'],
  [/про макс|промакс/gi, 'pro max'],
  [/бордовый/gi, 'burgundy'],
  [/ледяной|голубой/gi, 'glacier blue'],
  [/серебристый|серебро|белый/gi, 'silver'],
  [/чёрный|черный/gi, 'black'],
  [/оранжевый/gi, 'orange'],
  [/синий/gi, 'blue'],
  [/тб|терабайт/gi, 'tb'],
  [/гб|гигабайт/gi, 'gb'],
];

function normalizeQuery(q: string): string {
  let out = q.toLowerCase().trim();
  for (const [rx, rep] of RU_SYNONYMS) {
    out = out.replace(rx, rep);
  }
  return out;
}

interface Props {
  products: ProductItem[];
  categories: CategoryInfo[];
  manifest: Record<string, ImageAsset>;
  initialCategory?: string;
}

function fmtPrice(p: number) {
  return `${p.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')}\u00A0₽`;
}

function buildWa(title: string, price?: number) {
  const suffix = price ? ` (${fmtPrice(price)})` : '';
  const text = `Здравствуйте! Хочу уточнить наличие в SUPER STORE (ТРЦ «РИО»): ${title}${suffix}.`;
  return `https://api.whatsapp.com/send?phone=79312020078&text=${encodeURIComponent(text)}`;
}

const INPUT_STYLE = 'w-full px-4 py-2.5 text-[15px] text-fg bg-transparent placeholder:text-fg-muted focus:outline-none';

export default function CatalogExplorer({
  products,
  categories,
  manifest,
  initialCategory = 'all',
}: Props) {
  const [category, setCategory] = useState(initialCategory);
  const [storage, setStorage] = useState<string>('all');
  const [color, setColor] = useState<string>('all');
  const [sim, setSim] = useState<string>('all');
  const [minPriceInput, setMinPriceInput] = useState<string>('');
  const [maxPriceInput, setMaxPriceInput] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [viewMode, setViewMode] = useState<'models' | 'all'>('models');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Hydrate initial filters from URL query string
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    const st = params.get('storage');
    const col = params.get('color');
    const sm = params.get('sim');
    const sort = params.get('sort');
    const view = params.get('view');
    const filters = params.get('filters');

    if (q) setSearch(q);
    if (st) setStorage(st);
    if (col) setColor(col);
    if (sm) setSim(sm);
    if (sort === 'price-asc' || sort === 'price-desc') setSortBy(sort);
    if (view === 'all') setViewMode('all');
    if (filters === '1' || st || col || sm) setFiltersOpen(true);
  }, []);

  // Derive available facet options from category-scoped products (contextual filters)
  const scopedProducts = useMemo(
    () => (category === 'all' ? products : products.filter((p) => p.category === category)),
    [products, category]
  );

  const storageOptions = useMemo(() => {
    const order = ['128 GB', '256 GB', '512 GB', '1 TB', '2 TB', '8/128 GB', '8/256 GB', '16/1 TB'];
    const set = new Set(scopedProducts.map((p) => p.storage).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [scopedProducts]);

  const colorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of scopedProducts) {
      if (p.color && !map.has(p.color)) {
        map.set(p.color, p.colorHex || '#888888');
      }
    }
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [scopedProducts]);

  const hasSimFacet = useMemo(
    () => scopedProducts.some((p) => Boolean(p.simSlug)),
    [scopedProducts]
  );

  // Filter all matching SKUs
  const filteredItems = useMemo(() => {
    const normQ = normalizeQuery(search);
    const tokens = normQ ? normQ.split(/\s+/).filter(Boolean) : [];
    const minP = minPriceInput ? Number(minPriceInput) : null;
    const maxP = maxPriceInput ? Number(maxPriceInput) : null;

    const list = scopedProducts.filter((item) => {
      if (storage !== 'all' && item.storage !== storage) return false;
      if (color !== 'all' && item.color !== color) return false;
      if (sim !== 'all') {
        if (sim === 'sim-esim' && item.simSlug !== 'sim-esim') return false;
        if (sim === 'esim' && item.simSlug !== 'esim') return false;
      }
      if (minP !== null && !Number.isNaN(minP) && item.price < minP) return false;
      if (maxP !== null && !Number.isNaN(maxP) && item.price > maxP) return false;

      if (tokens.length > 0) {
        const hay = [
          item.title,
          item.sourceTitle,
          item.modelTitle,
          item.category,
          item.storage,
          item.color,
          item.colorRu,
          item.sim,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price-desc') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    return list;
  }, [scopedProducts, storage, color, sim, minPriceInput, maxPriceInput, search, sortBy]);

  // Group matching SKUs into model cards when viewMode === 'models'
  const groupedCards = useMemo(() => {
    const map = new Map<string, ProductItem[]>();
    for (const item of filteredItems) {
      const arr = map.get(item.modelSlug) || [];
      arr.push(item);
      map.set(item.modelSlug, arr);
    }

    const cards = Array.from(map.entries()).map(([modelSlug, items]) => {
      const prices = items.map((i) => i.price);
      const minPrice = Math.min(...prices);
      const preferred =
        (color !== 'all' ? items.find((i) => i.color === color && i.imageKey) : null) ||
        items.find((i) => i.color === 'Glacier' && i.imageKey) ||
        items.find((i) => i.imageKey) ||
        items[0];

      const params = new URLSearchParams();
      if (items.length === 1) {
        if (items[0].storageSlug) params.set('storage', items[0].storageSlug);
        if (items[0].color) params.set('color', items[0].color.toLowerCase().replace(/\s+/g, '-'));
        if (items[0].simSlug) params.set('sim', items[0].simSlug);
      } else {
        if (storage !== 'all' && preferred.storageSlug) params.set('storage', preferred.storageSlug);
        if (color !== 'all' && preferred.color) {
          params.set('color', preferred.color.toLowerCase().replace(/\s+/g, '-'));
        }
        if (sim !== 'all') params.set('sim', sim);
      }
      const qs = params.toString();

      return {
        key: modelSlug,
        title: items.length === 1 ? items[0].title : items[0].modelTitle,
        displayTitle:
          (items.length === 1 ? items[0].modelTitle : items[0].modelTitle).replace(' с дисководом', ''),
        url: `/catalog/${items[0].category}/${modelSlug}/${qs ? `?${qs}` : ''}`,
        minPrice,
        isFromPrice: items.length > 1 && new Set(prices).size > 1,
        imageKey: preferred.imageKey,
        note: items.length === 1 ? items[0].note : null,
      };
    });

    if (sortBy === 'price-asc') {
      cards.sort((a, b) => a.minPrice - b.minPrice);
    } else if (sortBy === 'price-desc') {
      cards.sort((b, a) => a.minPrice - b.minPrice);
    }
    return cards;
  }, [filteredItems, color, storage, sim, sortBy]);

  const activeFacetCount =
    (storage !== 'all' ? 1 : 0) +
    (color !== 'all' ? 1 : 0) +
    (sim !== 'all' ? 1 : 0) +
    (minPriceInput ? 1 : 0) +
    (maxPriceInput ? 1 : 0);

  const resetFilters = () => {
    if (initialCategory === 'all') setCategory('all');
    setStorage('all');
    setColor('all');
    setSim('all');
    setMinPriceInput('');
    setMaxPriceInput('');
    setSearch('');
    setSortBy('featured');
  };

  const selectCategory = (slug: string) => {
    setCategory(slug);
    setStorage('all');
    setColor('all');
    setSim('all');
  };

  const tabs = [
    { slug: 'all', title: 'Все' },
    ...categories.map((c) => ({ slug: c.slug, title: c.title })),
  ];

  return (
    <div class="space-y-10">
      {/* Row 1: category tabs + search + sort + filters trigger — products start above the fold */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
        <div
          class="lg:col-span-6 flex flex-wrap items-center gap-x-5 gap-y-2"
          role="tablist"
          aria-label="Категории каталога"
        >
          {tabs.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              role="tab"
              aria-selected={category === tab.slug}
              onClick={() => selectCategory(tab.slug)}
              class={`type-small transition-colors pb-1 bg-transparent p-0 ${
                category === tab.slug
                  ? 'font-semibold text-fg underline underline-offset-8'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        <div class="lg:col-span-6 flex items-center gap-4">
          <div class="flex-1 min-w-0" style="border: 1px solid var(--divider); border-radius: 10px;">
            <label for="catalog-search-input" class="sr-only">Поиск устройства</label>
            <input
              id="catalog-search-input"
              type="search"
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              placeholder="Поиск по модели, памяти, цвету"
              class={INPUT_STYLE}
            />
          </div>

          <div class="shrink-0" style="border: 1px solid var(--divider); border-radius: 10px;">
            <label for="catalog-sort-select" class="sr-only">Сортировка</label>
            <select
              id="catalog-sort-select"
              value={sortBy}
              onChange={(e) =>
                setSortBy((e.target as HTMLSelectElement).value as 'featured' | 'price-asc' | 'price-desc')
              }
              class={`${INPUT_STYLE} pr-8 appearance-none`}
            >
              <option value="featured">Популярные</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="catalog-filters-panel"
            class="shrink-0 type-small font-semibold text-fg hover:text-brand transition-colors bg-transparent p-0"
          >
            Фильтры{activeFacetCount > 0 ? ` · ${activeFacetCount}` : ''}
          </button>
        </div>
      </div>

      {/* Filters drawer: Memory, SIM, Color dots, Price (contextual) */}
      {filtersOpen && (
        <div
          id="catalog-filters-panel"
          class="pt-8 pb-2 grid grid-cols-2 md:grid-cols-4 gap-8"
          style="border-top: 1px solid var(--divider);"
        >
          {storageOptions.length > 0 && (
            <div>
              <div class="type-small text-fg-muted mb-3">Память</div>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStorage('all')}
                  class={`type-small pb-0.5 bg-transparent p-0 transition-colors ${
                    storage === 'all'
                      ? 'font-semibold text-fg underline underline-offset-4'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  Любая
                </button>
                {storageOptions.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStorage(storage === st ? 'all' : st)}
                    class={`type-small tabular-nums pb-0.5 bg-transparent p-0 transition-colors ${
                      storage === st
                        ? 'font-semibold text-fg underline underline-offset-4'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasSimFacet && (
            <div>
              <div class="type-small text-fg-muted mb-3">Тип SIM</div>
              <div class="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'sim-esim', label: 'SIM + eSIM' },
                  { id: 'esim', label: 'eSIM' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSim(opt.id)}
                    class={`type-small pb-0.5 bg-transparent p-0 transition-colors ${
                      sim === opt.id
                        ? 'font-semibold text-fg underline underline-offset-4'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colorOptions.length > 0 && (
            <div>
              <div class="type-small text-fg-muted mb-3">
                Цвет{color !== 'all' ? `: ${color}` : ''}
              </div>
              <div class="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setColor('all')}
                  aria-label="Любой цвет"
                  class="type-small text-fg-muted hover:text-fg bg-transparent p-0"
                >
                  Все
                </button>
                {colorOptions.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColor(color === c.name ? 'all' : c.name)}
                    aria-label={c.name}
                    aria-pressed={color === c.name}
                    title={c.name}
                    class="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105"
                  >
                    <span
                      class={`w-6 h-6 rounded-full ring-1 ring-black/15 ${
                        color === c.name ? 'ring-2 ring-brand ring-offset-2 ring-offset-white' : ''
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div class="type-small text-fg-muted mb-3">Цена, ₽</div>
            <div class="grid grid-cols-2 gap-3">
              <input
                type="number"
                inputMode="numeric"
                value={minPriceInput}
                onInput={(e) => setMinPriceInput((e.target as HTMLInputElement).value)}
                placeholder="От"
                aria-label="Минимальная цена в рублях"
                class="px-3 py-2 text-sm tabular-nums text-fg bg-transparent focus:outline-none"
                style="border: 1px solid var(--divider); border-radius: 10px;"
              />
              <input
                type="number"
                inputMode="numeric"
                value={maxPriceInput}
                onInput={(e) => setMaxPriceInput((e.target as HTMLInputElement).value)}
                placeholder="До"
                aria-label="Максимальная цена в рублях"
                class="px-3 py-2 text-sm tabular-nums text-fg bg-transparent focus:outline-none"
                style="border: 1px solid var(--divider); border-radius: 10px;"
              />
            </div>
          </div>

          <div class="col-span-2 md:col-span-4 flex flex-wrap items-center justify-between gap-4 pt-2">
            <div class="flex items-center gap-5" role="group" aria-label="Режим показа каталога">
              <button
                type="button"
                onClick={() => setViewMode('models')}
                class={`type-small bg-transparent p-0 transition-colors ${
                  viewMode === 'models'
                    ? 'font-semibold text-fg underline underline-offset-4'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                По моделям
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                class={`type-small bg-transparent p-0 transition-colors ${
                  viewMode === 'all'
                    ? 'font-semibold text-fg underline underline-offset-4'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                Все конфигурации
              </button>
            </div>
            {activeFacetCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                class="type-small font-semibold text-fg hover:text-brand transition-colors bg-transparent p-0"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>
      )}

      {/* Result count */}
      <p class="type-small text-fg-muted m-0" aria-live="polite">
        {viewMode === 'all' ? filteredItems.length : groupedCards.length} поз.
      </p>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div class="py-16 space-y-4">
          <h2 class="text-xl font-semibold m-0">Ничего не найдено</h2>
          <p class="type-body text-fg-muted m-0 max-w-[48ch]">
            Сбросьте часть параметров или напишите менеджеру — проверим наличие нужного устройства в магазине.
          </p>
          <div class="flex items-center gap-8 pt-2">
            <button
              type="button"
              onClick={resetFilters}
              class="arrow-link"
            >
              Сбросить фильтры
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <a
              href={buildWa(search || 'устройство в наличии')}
              target="_blank"
              rel="noopener noreferrer"
              data-goal="click_whatsapp"
              class="arrow-link"
            >
              Написать в WhatsApp
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      ) : viewMode === 'models' ? (
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
          {groupedCards.map((card) => {
            const img = card.imageKey ? manifest[`${card.imageKey}-f7`] || manifest[card.imageKey] : null;
            return (
              <a href={card.url} class="group block product-tile">
                <div
                  class="aspect-square flex items-center justify-center overflow-hidden"
                  style="background-color: var(--surface);"
                >
                  {img ? (
                    <picture class="w-full h-full">
                      <source type="image/avif" srcset={img.avifSrcset} sizes="(max-width: 640px) 44vw, 260px" />
                      <source type="image/webp" srcset={img.webpSrcset} sizes="(max-width: 640px) 44vw, 260px" />
                      <img
                        src={img.src}
                        alt={card.title}
                        width={img.width}
                        height={img.height}
                        loading="lazy"
                        class="w-full h-full object-cover object-left"
                      />
                    </picture>
                  ) : (
                    <span class="type-small text-fg-muted px-8 text-center">Фото уточняется у менеджера</span>
                  )}
                </div>
                <div class="pt-3 pb-1">
                  <h3 class="text-[1rem] font-semibold text-fg leading-snug m-0">{card.displayTitle}</h3>
                  <p class="text-[0.9375rem] text-fg-muted mt-1 mb-0 tabular-nums">
                    {card.isFromPrice ? `от ${fmtPrice(card.minPrice)}` : fmtPrice(card.minPrice)}
                  </p>
                  {card.note && <p class="type-small text-fg-muted mt-1.5 mb-0">{card.note}</p>}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        /* Individual SKU view (all 30 exact configurations) */
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
          {filteredItems.map((item) => {
            const img = item.imageKey ? manifest[`${item.imageKey}-f7`] || manifest[item.imageKey] : null;
            const params = new URLSearchParams();
            if (item.storageSlug) params.set('storage', item.storageSlug);
            if (item.color) params.set('color', item.color.toLowerCase().replace(/\s+/g, '-'));
            if (item.simSlug) params.set('sim', item.simSlug);
            const qs = params.toString();
            const href = `/catalog/${item.category}/${item.modelSlug}/${qs ? `?${qs}` : ''}`;
            const displayName = item.title.replace(' с дисководом', '');

            return (
              <a href={href} class="group block product-tile">
                <div
                  class="aspect-square flex items-center justify-center overflow-hidden"
                  style="background-color: var(--surface);"
                >
                  {img ? (
                    <picture class="w-full h-full">
                      <source type="image/avif" srcset={img.avifSrcset} sizes="(max-width: 640px) 44vw, 260px" />
                      <source type="image/webp" srcset={img.webpSrcset} sizes="(max-width: 640px) 44vw, 260px" />
                      <img
                        src={img.src}
                        alt={item.title}
                        width={img.width}
                        height={img.height}
                        loading="lazy"
                        class="w-full h-full object-cover object-left"
                      />
                    </picture>
                  ) : (
                    <span class="type-small text-fg-muted px-8 text-center">Фото уточняется у менеджера</span>
                  )}
                </div>
                <div class="pt-3 pb-1">
                  <h3 class="text-[1rem] font-semibold text-fg leading-snug m-0">{displayName}</h3>
                  <p class="text-[0.9375rem] text-fg-muted mt-1 mb-0 tabular-nums">{fmtPrice(item.price)}</p>
                  {item.note && <p class="type-small text-fg-muted mt-1.5 mb-0">{item.note}</p>}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
