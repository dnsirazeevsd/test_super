# UI Cleanup & Restraint — Verification Report

**Date:** 2026-11-25 · **Scope:** global theme, header/footer, product renders & cards, homepage, catalog, product configurator, news, map, owner-dependent elements.

All information was preserved: **30 products with exact RUB prices**, **5 news articles with verbatim bodies**, both phones (`+7 (931) 202-00-78`, `+7 (931) 202-00-88`), address (`Россия, Санкт-Петербург, улица Фучика, д. 2, ТРЦ «РИО»`), hours (ежедневно 10:00–22:00), Viber (`79312020078`), payment methods, all services, non-public-offer disclaimer, and the review form.

Automated checks after the cleanup: `npm run build` (34 pages) ✓ · `npm run verify-data` (30 prices match the source 100%, phones, hours, 5 news, unique titles/descriptions, canonical, H1, JSON-LD, `lang="ru"`, zero external hotlinking) ✓ · Playwright **375 px / 1440 px** — zero horizontal overflow on `/`, `/catalog/`, product page, `/contacts/` ✓ · **axe-core (light & dark): 0 violations** on 5 audited routes ✓ · **Lighthouse Mobile: Performance 98 / Accessibility 100 / Best Practices 100 / SEO 100**, LCP 2.2 s, CLS 0, TBT 0 ms.

---

## 1. Global

- New flat tokens: brand violet **`#6D28D9`** (hover `#5B21B6`), page `#F7F7F9`, cards `#FFFFFF`, text `#17171C`, secondary `#6B6B76`, borders `1px rgba(0,0,0,0.06)`. The only remaining gradient is the subtle hero backdrop. Apple blue/palette untouched and unused.
- Light theme is now the **default** (dark theme available via the header toggle).
- `scroll-margin-top: 96px` on all anchored sections (plus `scroll-padding-top: 96px` on `html`) — no more overlap under the fixed header.
- Header: square logo replaced by the text wordmark **SUPER STORE** + caption **«СПб · ТРЦ «РИО»»** (square logo kept for favicon & footer); the «Написать» button replaced by the clickable **+7 (931) 202-00-78**.
- Footer & `/contacts/` show both phones; footer social row is a single non-wrapping Viber row (Viber kept).
- Floor references («1 этаж») removed from every page **and** from JSON-LD structured data.

## 2. Product cards & renders

- Card photo area is one seamless white surface — the inner gray rectangle and every badge over the photo are gone. Statuses **● В наличии** + **Новый, запечатанный** now sit in the text area above the product name (max two).
- Unified renders, same angle/scale/padding, all on pure `#FFFFFF` backgrounds (`scripts/normalize-white.py`). Wrong-device renders fixed:
  - Re-created from the verified Glacier master render: **iPhone 18 Pro Black / Silver / Burgundy**, **iPhone 17 Pro Deep Blue**, **iPhone 17 Pro Max Cosmic Orange** (each visually verified).
  - **iPhone 17 Pro Silver** and **iPhone 17 Pro Max Silver** now use the verified unified silver render (the Pixel-visor file was retired).
  - Non-iPhone renders replaced with clean studio renders: **MacBook Air 13 M5**, **Samsung A57 5G**, **Galaxy Watch 8 Ultra**, **PS5 Slim** (purple VK banner photos retired).
- No render shows a different device than the product.

## 3. Homepage

- Hero: `line-height 1.08`, tighter copy, «ТРЦ «РИО»» mentioned once; the right device card lost the four corner captions and inner gray square, keeping one badge «В наличии в СПб»; Pause control minimized to an icon button (still keyboard-accessible, plus arrow/Home/End keys).
- Advantages: ~1/3 shorter cards with minimal outline icons (shield, pin, gift, data transfer) instead of 01–04; max two lines each.
- Categories «Устройства в наличии»: numeric counters removed (neutral «В наличии»), large clean renders instead of small icons.
- The long boilerplate paragraph was removed from the middle; a short version lives once in a thin strip above the footer.
- Services: 5 compact linkable cards (no badges, no per-card buttons) + one shared CTA block.
- The large purple Trade-In banner is replaced by a compact **«Оценить устройство»** form (model + condition + phone → opens мессенджер with a prefilled manager message). No price estimates or invented numbers.
- «How to buy»: light single-row horizontal scheme separated by thin rules, no heavy cards.
- News cards use clean covers without embedded ad text and normalized display titles (see §6).
- Map: Yandex iframe now auto-loads via `IntersectionObserver` (320 px root margin, no «Загрузить карту» button) with a static schematic pre-load state; no indoor floor plan.

## 4. Catalog `/catalog/`

- Sticky gray strip, duplicate category buttons, and the SEO info block are removed.
- Categories render once as clean tabs: **Все, iPhone, MacBook, Samsung, Часы, Консоли**.
- First screen = tabs + search + sort only. Memory, SIM type, colors (small dots), and price live under the **«Фильтры»** button with an active-count badge; filters are contextual (iPhone selection hides `16/1 TB`, `8/128 GB` etc.; «Все» merges them).
- Model-view / all-SKUs toggle moved into the filters drawer; result count shown once below.

## 5. Product page

- Right column is frameless directly on the page background, separated by thin 1px rules; the eyebrow «ОРИГИНАЛЬНОЕ УСТРОЙСТВО С ГАРАНТИЕЙ» and the «Цена выбранной конфигурации» label are removed — only the large price remains.
- H1 is the clean model name (e.g. **«iPhone 17 Pro»**); the full configuration stays in `<title>`, meta description and per-SKU JSON-LD Offers; selected storage/color/SIM show in the selectors.
- «Поделиться конфигурацией» is now a compact icon with a copy-confirmation tooltip.
- The SIM/eSIM explanation moved into a **(?)** tooltip next to «Версия SIM».
- One primary **«Узнать наличие»** button (мессенджер prefilled with the exact model, configuration and price) + compact **«Позвонить +7 (931) 202-00-78»** (never wraps) and a Viber link.
- Left photo block: uniform white background, no inner rectangle, no magnifier icon, no blue text over the photo; **«Подарок при покупке каждого устройства»** moved under the price.

---

## 6. News display titles — awaiting owner approval

Article bodies, dates, images and URLs are untouched; only the displayed card/heading title is normalized (stored as `displayTitle` in each post's frontmatter, original `title` kept verbatim):

| Date | Original title (kept in body) | Display title (proposed) |
| --- | --- | --- |
| 07-11-2026 | 🚨 Не можешь установить нужное приложение на iPhone? ЕСТЬ РЕШЕНИЕ! | Не можешь установить нужное приложение на iPhone? Есть решение! |
| 04-11-2026 | Думаете, за старый смартфон в Trade-In предложат копейки? | unchanged (already clean) |
| 17-09-2026 | Иногда так сложно расставаться… | unchanged (already clean) |
| 13-09-2026 | Цены на предзаказ : iPhone 18 про / 18 про мах   В наличии с 23.09 | Цены на предзаказ: iPhone 18 Pro / 18 Pro Max. В наличии с 23.09 |
| 12-09-2026 | Apple показала новый iPhone Duo - а мы знаем, как его применить✌️ | Apple показала новый iPhone Duo — а мы знаем, как его применить |

Clean cropped covers (no baked-in ad text) were generated for all 5 cards; the full original images remain intact inside the article bodies. To reject a normalization, delete the `displayTitle` (and/or `cover`) line from the post's frontmatter and rebuild.

## 7. Products shown with a neutral placeholder (no accurate render)

| Product | Price | Reason |
| --- | --- | --- |
| iPhone 16 Pro 128 GB | 104 990 ₽ | No color confirmed in source data → neutral branded placeholder + manager note (unchanged behavior). |
| iPhone 17 Air 1 TB Space Black | 97 990 ₽ | The only available render had a Pixel-style camera visor — retired; placeholder until a verified render exists. |
| MacBook Neo 13 A16 8/256 GB | 73 190 ₽ | Only the purple VK banner photo existed; placeholder until a real photo/render is provided. |

All three show a clean device-line placeholder with «Фото уточняется» and a note to ask the manager; each is flagged `isTemporaryPhoto: true` in `src/data/products.json`.

## 8. Items hidden because owner data is missing (no placeholders in UI)

1. **Telegram handle/link** — not rendered anywhere (kept only Viber). The separate apps helper bot `superstore.arfgift.ru` (real source data from the news post) remains linked on `/services/data-transfer/`.
2. **VK link** — legacy `vk.com/Apple_SS_178` stored in `site.json` but not rendered; restore after owner confirmation.
3. **Company legal details** (`[OWNER_COMPANY_NAME]`, `[OWNER_INN]`, `[OWNER_OGRN]`, `[OWNER_LEGAL_ADDRESS]`, `[OWNER_EMAIL]`) — the footer «Реквизиты продавца» line and the `/contacts/` «Реквизиты организации» block are hidden; `/privacy/` + `/terms/` now use neutral wording (requisites on request) instead of placeholders, and the orange owner-note boxes were removed.
4. **Reviews/ratings widget** — only the «Оставить отзыв» form is shown (its `[EMAIL_OR_TELEGRAM_BOT]` debug caption removed; endpoint stays in `site.json`/README). No ratings until real reviews or Yandex/2GIS org IDs arrive.
5. **Floor number** («1 этаж») — removed everywhere until the owner confirms (data note kept in `site.json → ownerPending`).
6. **Real store interior photos & indoor floor plan** — not provided, none faked.

Each item is documented in `README.md → "Hidden UI Elements Pending Owner Data"` with restore instructions.

## 9. Deliverables

- Source archive: `superstore-rio-project.zip` · Static build: `superstore-rio-static-build.zip` (both regenerated after the cleanup).
- Live preview: Astro static server on `0.0.0.0:4321` (all 34 routes).
- Updated docs: `README.md` (tokens, hidden-items checklist, cover/displayTitle guide), `DESIGN_BRIEF.md` (new palette table).
