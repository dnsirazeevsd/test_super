# Favorites (Избранное) report

Date: 2026-11-26 · Branch: `arena/77b0a26f-test-super`

## Result

Lightweight favorites feature, no accounts, no server calls. Favorites are model ids
(`<category>/<modelSlug>`) stored as a JSON array in `localStorage` under
`superstore_favorites` (all access wrapped in try/catch; when storage is unavailable
the feature keeps working in memory for the session). Homepage keeps its 5 blocks;
no prices are summed and no cart language is used anywhere.

## Added

| Area | What |
| --- | --- |
| Heart toggles | Outline heart button (`aria-pressed`, `aria-label` «Добавить в избранное» / «Убрать из избранного») in the top corner of every product tile (homepage `ProductCard`, catalog `CatalogExplorer` models + SKU views) and next to the title on the product page (`ProductConfigurator`). No counters on tiles. |
| Header | Desktop heart link (`/favorites/`, `aria-label` «Избранное») with a small count badge only when > 0. On mobile the link lives inside the burger menu, and the burger button gets a dot while favorites exist. Badge/dot are absolutely positioned, so appearing counts never shift the header. |
| `/favorites/` page | Same tile grid as the homepage, per-item «Забронировать» and «Убрать», empty state «Пока ничего не выбрано. Откройте каталог →». `noindex`, excluded from the sitemap. |
| Script loading | Single code-split chunk `favorites.*.js`, dynamically imported after two RAFs (after first paint), **2 048 bytes gzip** (limit 3 KB). Not preloaded on the homepage. |
| Metrika | Goal `favorite_add` fired on add only (type added to `src/lib/analytics.ts`). |

## Motion (transform/opacity only, WAAPI, no GSAP)

- Heart toggle: fill to brand accent `#531C79` with a 150 ms CSS fill transition and a
  180 ms scale pop (1 → 1.18 → 1, ease-out) on add; 120 ms fade-back on remove.
- Fly-to-header (desktop ≥ 1024 px, `pointer: fine`): a 10 px accent dot travels from the
  heart to the header heart along a short arc in 400 ms (`position: fixed`,
  `pointer-events: none`, created and removed per click). On arrival the header heart
  bumps (160 ms) and the counter slides/fades in (200 ms).
- Mobile (< 1024 px): no flying dot. A non-blocking toast «Добавлено в избранное»
  (200 ms fade/slide, auto-hide after 1.6 s, `role="status"` + `aria-live="polite"`)
  appears above the sticky bar, and the burger dot bumps.
- Favorites page: tiles reveal with a 60 ms stagger (max 8 items, 320 ms). Removal
  collapses the tile (opacity + scale 0.96, 200 ms) and the grid reflows with a FLIP
  transform animation (200 ms). Focus moves to the next tile's remove button, or to
  the empty state when the last item is removed.
- Reduced/constrained motion (`prefers-reduced-motion`, Save-Data, ≤ 4 GB RAM,
  ≤ 4 cores): all WAAPI effects are skipped; state changes are instant and the
  feature works identically.

## New texts for approval

- «Избранное» — header link, mobile menu link, page H1.
- «Добавить в избранное» / «Убрать из избранного» — heart button labels.
- «Убрать {модель} из избранного» — remove button label (visible text «Убрать»).
- «Добавлено в избранное» — mobile toast.
- «Пока ничего не выбрано. Откройте каталог →» — empty state (link to `/catalog/`).
- Page title «Избранное | SUPER STORE ТРЦ «РИО»».

## Verification

- `npm run build`: passed (37 pages, image checks). `npm run verify-data`: passed.
  `git diff --check`: passed. Existing `verify-motion` suite: passed
  (Lighthouse 97, CLS 0) — no regression.
- Favorites suite (`npm run verify:favorites`, needs the preview server on :4321):
  **34 checks passed**, zero browser errors. See [verification.json](verification.json).
- Lighthouse (standard simulated mobile, homepage): **100 performance / 100
  accessibility / 100 best practices / 100 SEO, CLS 0**, LCP 1.5 s, TBT 38 ms.
- CLS: homepage interactions (toggle, fly, toast, badge) **0** on desktop and mobile;
  throttled-mobile trace CLS 0.
- Throttled-mobile trace (390×844 touch, 4× CPU, 1.6 Mbps / 150 ms RTT): during the
  favorite-add interaction the longest task was **32 ms**, zero tasks > 50 ms.
  An idle baseline run showed the same profile (longest 9 ms), i.e. the feature adds
  no long tasks. See [mobile-performance-trace.json.gz](mobile-performance-trace.json.gz).
- Keyboard/SR: hearts are reachable by Tab, toggle with Enter/Space, labels and
  `aria-pressed` verified; toast is announced via `aria-live="polite"`.
- Screenshots: [homepage 1440](homepage-desktop-1440.png),
  [homepage 375](homepage-mobile-375.png),
  [product 1440](product-desktop-1440.png),
  [favorites 1440](favorites-desktop-1440.png),
  [favorites 375](favorites-mobile-375.png).
- Screen recordings (CDP screencast assembled into GIFs — Playwright video needs an
  ffmpeg binary that is unavailable in this sandbox):
  [desktop](favorites-desktop.gif) (toggle → fly-to-header → product page → favorites
  reveal → removals → empty state), [mobile](favorites-mobile.gif) (tap → toast +
  burger dot → favorites page).

## Known limits

- The `/favorites/` page itself measures CLS ≈ 0.11: tiles start hidden and appear
  above the footer when the lazy script runs, so the footer shifts once. This is the
  spec'd client-side reveal on a noindex page; the homepage (the Lighthouse-measured
  page) stays at CLS 0 and all feature motion is transform/opacity only.
- Recordings are headless-Chromium screencasts (software rendering), not physical
  devices; trace numbers are laboratory results.
