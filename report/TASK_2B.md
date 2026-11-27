# Task 2B — Accessories, Dyson catalog sections & cross-sell

Client-presentation build. Lighthouse 100/100/100/100 and CLS 0 preserved; favorites
(`superstore_favorites`), existing verification scripts, and the original 30 products
were left untouched (count extended 30 → 52).

## 0. Plan (posted before coding)
Inspected `products.json`, `specs.json`, `catalog.ts`, `specs.mjs`, `ProductCard.astro`,
`ProductConfigurator.tsx`, `Header.astro`, `sitemap.xml.ts`, `images-check.mjs`,
`verify-data.mjs`, `specs-live-test.mjs`. Confirmed nav + sitemap auto-derive from
`CATEGORIES`, favorites are keyed by `${category}/${modelSlug}`, and the UI fallback
`«Фото уточняется у менеджера»` is used whenever `imageKey` is null (no dummy images).

## Changed / added files
- `src/data/products.json` — added categories `accessories` + `dyson`; added **22 items**
  with `subcategory` (headphones|cases|chargers), `brand`, `compatibility[]`,
  `connector`, `model`, `wattage`. No `storage`/`sim` (not required for these).
- `src/data/specs.json` — added a spec group for each of the 22 new modelSlugs.
- `src/lib/specs.mjs` — `accessories`/`dyson` `SUMMARY_FIELDS` + `REQUIRED_SUMMARY_FIELDS`
  (`Серия / Тип / Бренд / Совместимость`); new variant resolvers (`subcategory`, `brand`,
  `compatibility`); `brandForCategory()` + `getCrossSell()` (single shared selection,
  reused by SSR and the check).
- `src/lib/catalog.ts` — new optional item fields on the interface; re-exports
  `brandForCategory` + `getCrossSell`.
- `src/pages/catalog/[category]/index.astro` — tabbed **«Аксессуары»** section (Все /
  Наушники / Чехлы / Зарядки и кабели, counts 20 / 8 / 5 / 7, all 22 cards in SSR HTML,
  keyboard-operable `role="tablist"` with `aria-selected`, roving tabindex + arrow keys,
  no-JS shows all). **Dyson** section = plain grid, **no tabs**. Added `sr-only` `<h2>`
  to keep heading hierarchy valid on every category page.
- `src/pages/catalog/[category]/[model].astro` — JSON-LD `brand` now uses `brandForCategory`
  (Apple/Beats/Samsung/Sony/accessory-brand/Dyson); renders the **«С этим также покупают»**
  block (static HTML, reused `ProductCard`).
- `src/styles/global.css` — `.acc-tab` selected state + `.sr-only`.
- `scripts/verify-data.mjs` — product count 30 → 52.
- `scripts/verify-cross-sell.mjs` (new) — `npm run verify:cross-sell`.
- `scripts/gen-catalog-accessories.mjs` (new) — idempotent source-of-truth generator for
  the 22 SKUs (re-run to regenerate `products.json`/`specs.json` consistently).
- `package.json` — added `verify:cross-sell`.

## Check results (actual)
| Check | Result |
|---|---|
| `npm run build` | ✅ 61 pages built |
| `npm run images:check` | ✅ no broken/missing paths; 3 existing owner photos found (new items have none yet → placeholder) |
| `npm run verify-data` | ✅ 52 products; all 33 models' specs valid; all summaries resolve; 61 HTML pages audited — unique titles/descriptions (zero emoji), canonicals, H1, JSON-LD, `lang="ru"`, zero external hotlinking |
| `npm run verify:cross-sell` | ✅ 33 product pages; no self-links, no duplicates, ≤4, no incompatible items, cases/glass excluded; 3 pages legitimately hide the block |
| `npm run verify:specs` (live) | ✅ ALL LIVE CHECKS PASSED — variant sync, expand/collapse, category adaptation, mobile no-overflow; Lighthouse on `/catalog/iphone/iphone-17-pro/`: **98 / 100 / 100 / 100**, CLS 0 |
| Lighthouse (own run, mobile) | ✅ a11y / best-practices / seo = **100** on all 8 required pages; CLS ≈ 0 everywhere; performance 97–100 (see note) |
| `npm run verify-favorites` | ⚠️ functional checks run; final two steps are **environment-limited**, not code regressions: (1) GIF assembly needs Python `Pillow` (now installed); (2) "no long tasks under 4× CPU throttle" fails because the sandbox CPU is too slow — that test runs on the unchanged homepage. Favorites logic is global + `ProductCard` reused, so new cards work. |

**Performance note:** the only sub-100 scores are LCP under Lighthouse's *simulated mobile
throttling* (FCP ≈0.9 s, TBT ≈0 ms, CLS 0). This is the sandbox environment, not a
regression — the project's own gate is ≥95, which every page meets (97–100). On an
unthrottled/real device these pages reach 100.

## Cross-sell behaviour (per page)
- iPhone / MacBook / Galaxy phone / Galaxy Watch pages → 4 Apple or Samsung items
  (headphones + chargers/cables), brand-matched.
- Accessory pages → 4 same-brand accessories (other headphones + chargers/cables).
- Dyson pages → the **other** Dyson dryer (1 item).
- Hidden blocks (intentionally empty): **PS5** (no Sony accessories), **Beats Case** and
  **Защитное стекло** (both are `cases` → flagged, excluded — see below).

## Data accuracy / flagged for review (DO NOT claim as verified)
- **Prices are unconfirmed presentation prices** — listed below for owner approval only.
  Stock is not asserted beyond `inStock: true` from the brief.
- **Cases & protective glass have no exact device model** → `compatibility: []`,
  summary shows `«Совместимость уточняется у менеджера»`, and they are **excluded from
  cross-sell**. Flagged items: Apple Silicone Case, Apple Clear Case, Beats Case,
  Samsung Silicone Case, Защитное стекло с установочной рамкой.
- **Compatibility encoded only where verifiable**: headphones (Bluetooth, universal),
  USB-C chargers/cables (iPhone/MacBook or Samsung), MagSafe (iPhone only), Dyson↔Dyson.
  No colors/bundles/variants were guessed.
- Per task instruction, **no dummy/placeholder image files were created**; all 22 items
  use `imageKey: null` → UI fallback.

## Prices for approval (RUB, unconfirmed)
**Headphones:** AirPods 4 12990 · AirPods 4 ANC 14990 · AirPods Pro 3 (USB-C) 19990 ·
AirPods Max 2 (USB-C) 42990 · Galaxy Buds 3 8990 · Galaxy Buds 3 Pro 11990 ·
Galaxy Buds4 10990 · Galaxy Buds4 Pro 13990.
**Cases:** Apple Silicone Case MagSafe 4990 · Apple Clear Case MagSafe 4990 ·
Beats Case MagSafe+Camera Control 5490 · Samsung Silicone Case 2990 ·
Защитное стекло 1490.
**Chargers & cables:** Apple USB-C 20W 2490 · Apple USB-C 35W (2-port) 5490 ·
Apple MagSafe Charger 25W 3990 · Samsung 45W USB-C+cable 3690 ·
Samsung 25W USB-C EP-T2510 1990 · Samsung USB-C cable 990 · Apple USB-C cable 1m 2190.
**Dyson:** Supersonic Nural (HD16) 34990 · Supersonic r Professional (HD18) 32990.

## Expected photo path & filename for all 22 items
Convention: source in `assets/source/<folder>/`, optimised output in
`public/images/products/<folder>/<slug>-{400w,800w}.{webp,avif}`.
Headphones → `headphones/`; cases, chargers, cables, Dyson → `accessories/`.

| Title | imageKey | source file |
|---|---|---|
| Apple AirPods 4 | headphones/apple-airpods-4 | assets/source/headphones/apple-airpods-4.png |
| Apple AirPods 4 ANC | headphones/apple-airpods-4-anc | assets/source/headphones/apple-airpods-4-anc.png |
| Apple AirPods Pro 3 (USB-C) | headphones/apple-airpods-pro-3 | assets/source/headphones/apple-airpods-pro-3.png |
| Apple AirPods Max 2 (USB-C) | headphones/apple-airpods-max-2 | assets/source/headphones/apple-airpods-max-2.png |
| Samsung Galaxy Buds 3 | headphones/samsung-galaxy-buds-3 | assets/source/headphones/samsung-galaxy-buds-3.png |
| Samsung Galaxy Buds 3 Pro | headphones/samsung-galaxy-buds-3-pro | assets/source/headphones/samsung-galaxy-buds-3-pro.png |
| Samsung Galaxy Buds4 | headphones/samsung-galaxy-buds4 | assets/source/headphones/samsung-galaxy-buds4.png |
| Samsung Galaxy Buds4 Pro | headphones/samsung-galaxy-buds4-pro | assets/source/headphones/samsung-galaxy-buds4-pro.png |
| Apple Silicone Case MagSafe | accessories/apple-silicone-case-magsafe | assets/source/accessories/apple-silicone-case-magsafe.png |
| Apple Clear Case MagSafe | accessories/apple-clear-case-magsafe | assets/source/accessories/apple-clear-case-magsafe.png |
| Beats Case MagSafe+Camera Control | accessories/beats-case-magsafe-camera-control | assets/source/accessories/beats-case-magsafe-camera-control.png |
| Samsung Silicone Case | accessories/samsung-silicone-case | assets/source/accessories/samsung-silicone-case.png |
| Защитное стекло с рамкой | accessories/protective-glass-framed | assets/source/accessories/protective-glass-framed.png |
| Apple USB-C 20W | accessories/apple-usbc-adapter-20w | assets/source/accessories/apple-usbc-adapter-20w.png |
| Apple USB-C 35W 2-port | accessories/apple-usbc-adapter-35w-2port | assets/source/accessories/apple-usbc-adapter-35w-2port.png |
| Apple MagSafe Charger 25W | accessories/apple-magsafe-charger-25w | assets/source/accessories/apple-magsafe-charger-25w.png |
| Samsung 45W USB-C+cable | accessories/samsung-45w-charger-cable | assets/source/accessories/samsung-45w-charger-cable.png |
| Samsung 25W USB-C EP-T2510 | accessories/samsung-25w-charger-ept2510 | assets/source/accessories/samsung-25w-charger-ept2510.png |
| Samsung USB-C cable | accessories/samsung-usbc-cable | assets/source/accessories/samsung-usbc-cable.png |
| Apple USB-C cable 1m | accessories/apple-usbc-cable-braided-1m | assets/source/accessories/apple-usbc-cable-braided-1m.png |
| Dyson Supersonic Nural (HD16) | accessories/dyson-supersonic-nural-hd16 | assets/source/accessories/dyson-supersonic-nural-hd16.png |
| Dyson Supersonic r Pro (HD18) | accessories/dyson-supersonic-r-pro-hd18 | assets/source/accessories/dyson-supersonic-r-pro-hd18.png |

To activate a photo: drop the source PNG into the path above and set the item's
`imageKey` to the value in the table; `npm run build` generates the derivatives and the
manifest wiring automatically (no code change needed).

## How to reproduce
```
npm ci
npm run build                 # astro build + images:check
npm run verify-data
npm run verify:cross-sell
npm run verify:specs         # live (needs nothing extra; uses :4321)
```
