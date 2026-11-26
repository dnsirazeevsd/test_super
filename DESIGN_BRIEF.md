# Design Brief & Sitemap — SUPER STORE (ТРЦ «РИО», Санкт-Петербург)

**Project:** Static website replacing `https://apple-ss-178.orgs.biz/`
**Target Domain Placeholder:** `https://superstore-rio.ru` (`[DOMAIN]` — replace in `astro.config.mjs` and `src/data/site.json` before launch)
**Language:** Russian (`<html lang="ru">`)
**Design language:** Editorial retail minimalism — lightness and simplicity above all. When a rule conflicts with "showing more", the rule wins.
**Stack:** Astro 5 (Static SSG) + Tailwind CSS + Preact islands (configurator, catalog explorer). No slider libraries, no GSAP/Lenis, no PhotoSwipe — motion is one 20-line IntersectionObserver system.

---

## 1. Palette (single light theme, WCAG 2.2 AA)

There is **no dark theme and no toggle** — one perfected light theme only.

| Role | Value | Notes |
| :--- | :--- | :--- |
| Page background | `#FFFFFF` | Full-bleed white bands |
| Surface (alt bands, tiles, photo area) | `#F7F7F9` | Alternates with white; no boxes inside |
| Text | `#111111` | **16.2:1** on white — AAA |
| Text muted | `#6B6B76` | **5.46:1** on white — AA |
| Divider | `#E6E6EA` | 1px hairlines only (config column, accordion, footer rule) |
| Filled button | `#111111` bg / white text | hover `#333333`; **max one per viewport** |
| Accent violet | `#6D28D9` | Small accents ONLY: logo mark, link hover, focus rings, color-dot selection ring. Never fills, banners or gradients |
| Semantic error / warning | `#B91C1C` / `#B45309` | Form validation only |

**Discipline:** no borders or shadows around content (allowed: form-control outlines, the Фильтры drawer, pill selector outlines, hairline separators, functional ring on color swatches). No bento grids, numbered cards, icon-in-box grids, pill tags above headings, glassmorphism, gradients, emoji, stacked badges, slider chrome. "Apple" is descriptive only — never in the site name, never with the Apple logo.

---

## 2. Typography

- **Family:** Manrope (self-hosted `public/fonts/`, Cyrillic + Latin, **weights 400 & 600 only**, `font-display: swap`, cyrillic woff2 preloaded).
- **Exactly three sizes:**
  - Display: `clamp(2.375rem, 4.2vw + 1rem, 4.125rem)`, `line-height: 1.08`, `letter-spacing: -0.02em`, weight 600
  - Body: `17px` mobile / `18px` desktop, `line-height: 1.6`
  - Small: `14px`, `line-height: 1.55` (prices keep `tabular-nums`)
- Paragraphs capped at `60ch` (`.measure`); prices are the only tabular text.

## 3. Layout & Motion

- Container `max-width: 1120px` (`.shell`, 20/32px gutters).
- Section padding: `.band` = 80px mobile / 140px desktop; slim `.band--slim` = 72/128px. Full-bleed sections alternate `#FFFFFF` / `#F7F7F9`, separated by whitespace only.
- One motion system: fade + 20px translate on scroll for headings/images (`[data-reveal]`, 550ms ease-out), gentle staggered hero reveal; `prefers-reduced-motion` disables everything. No text parallax, no hover jiggle.
- At 375px a screen holds ≤ one heading + one short paragraph + one action.

---

## 4. Sitemap & URL Architecture

| Route | Page Purpose | Content & Interactive Modules |
| :--- | :--- | :--- |
| `/` | Home — **exactly 5 blocks** | (1) 64px sticky white header: wordmark, 4 links, phone; hovering «Каталог» opens a full-width white menu with 5 category thumbnails; mobile = wordmark + phone icon + burger. (2) Hero: 6-word headline, 12-word subline, one filled CTA + one text-arrow link, large uncropped iPhone 18 Pro render. (3) Featured catalog: 8 borderless tiles on `#F7F7F9` + centered «Весь каталог (N устройств) →». (4) Slim Trade-In band: one sentence + one мессенджер CTA. (5) Contacts: address, hours, phones, Telegram + WhatsApp + lazy Yandex map with static schematic pre-load. Mobile bottom bar «Позвонить / мессенджер» appears after the hero |
| `/catalog/` | Catalog Hub | Row 1 = tabs (Все/iPhone/MacBook/Samsung/Часы/Консоли) + search + sort + «Фильтры»; products above the fold; filters in an expanding drawer (memory / SIM / color dots / price, contextual per category); model-grouped default view + all-30-SKU view; shared availability sentence once above the footer |
| `/catalog/<cat>/` | Category pages | Same explorer pre-filtered by category; ItemList JSON-LD |
| `/catalog/<cat>/<model>/` | Model / Product Detail (10 routes) | Zero-box 2-column: large render on uniform `#F7F7F9` + config column separated by 1px hairlines. Clean H1 (full config in `<title>`/meta/JSON-LD), one «В наличии в СПб» status, large price, compact share icon, pill selectors (memory / color dots / SIM with «?» tooltip), ONE filled мессенджер CTA prefilled with the exact config, Позвонить/Telegram/WhatsApp text links (phone never wraps), ONE accordion with real facts only (warranty, gift, payments, pickup). URL-shareable `?storage=&color=&sim=` |
| `/services/` + `/services/<slug>/` | Services hub & pages (Step 2) | Anchors `#trade-in #buyback #credit #transfer #payment`; title + 2–3 sentences + one мессенджер button each |
| `/news/` + `/news/<slug>/` | News (Step 2 restyle) | Clean list/grid: date/title/cover; article ≈65ch; bodies verbatim; display titles sentence-case (owner approval pending) |
| `/contacts/` | Contacts (Step 2 restyle) | Full contacts + map + review form; reviews block only with real org IDs |
| `/privacy/`, `/terms/` | Legal (Step 2 restyle) | Prose ≈65ch, no boxes |

---

## 5. Hidden UI Elements Pending Owner Data

Elements that require owner-only data are **hidden, never shown as placeholders** (`src/data/site.json`: `legalPlaceholders`, `ownerPending`, `integrations.formEndpoint`):

1. **Telegram handle** — Telegram renders across the site (phone-only `https://t.me/+79312020078` while `username` is empty); setting `telegram.username` in `site.json` switches to a clean `https://t.me/<username>` link and enables prefilled text. WhatsApp (`https://wa.me/79312020078`) is enabled.
2. **VK link** — legacy `vk.com/Apple_SS_178` kept in `site.json` but not rendered until confirmed.
3. **Company legal details** (`[OWNER_COMPANY_NAME]`, `[OWNER_INN]`, `[OWNER_OGRN]`, `[OWNER_LEGAL_ADDRESS]`, `[OWNER_EMAIL]`) — реквизиты blocks stay hidden; `/privacy/` + `/terms/` use neutral wording.
4. **Reviews / ratings** — only the review form is shown until real Yandex/2GIS org IDs arrive.
5. **Floor number (`"1 этаж"`)** — removed everywhere until owner confirms.
6. **Review-form endpoint** (`[EMAIL_OR_TELEGRAM_BOT]`) — config only; form shows a local success state until connected.

## 6. Performance Budget (verified 2026-11-25)

- Homepage external JS: **0 KB** (inline initializers only; islands hydrate on catalog/product pages).
- Lighthouse Mobile: **100 / 100 / 100 / 100**, LCP **1.5s** (preloaded AVIF + cyrillic woff2), CLS 0, TBT 0.
- axe-core (light + dark OS scheme, 5 routes): **0 violations**; no horizontal overflow at 375/1440.
