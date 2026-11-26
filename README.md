# SUPER STORE — Self-Hosted Website (Astro + Tailwind CSS + Preact)

Production-ready static website for **SUPER STORE** (`Apple Super Store | Продажа техники | ТРЦ «РИО»`, Saint Petersburg, ul. Fuchika, 2), replacing the legacy constructor page (`https://apple-ss-178.orgs.biz/`).

- **Site Language:** Russian (`<html lang="ru">`)
- **Stack:** Astro 5 (Static SSG), Tailwind CSS 3, Preact islands, PhotoSwipe v5 (MIT), GSAP + ScrollTrigger + Lenis + Motion
- **Content Storage:** 100% file-based (`src/data/products.json`, `src/data/site.json`, `src/content/news/*.md`) — no CMS database required.

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies (Node.js 20+ recommended)
npm install

# 2. Generate responsive AVIF + WebP images from assets/source/
npm run optimize-images

# 3. Start local dev server at http://localhost:4321
npm run dev

# 4. Build static production bundle into dist/
npm run build

# 5. Verify all 30 products, prices, contacts, SEO tags, and HTML integrity
npm run verify-data

# 6. Preview production build locally
npm run preview
```

---

## Content Management Guide (Step-by-Step)

### 1. How to Change a Price

1. Open `src/data/products.json` in any text editor.
2. Search (`Ctrl+F` / `Cmd+F`) for the product title or SKU ID (for example, `"iphone-18-pro-2tb-glacier-sim-esim"`).
3. Update the numeric `"price"` value (in Russian rubles, **digits only, no spaces or currency signs**):
   ```json
   "price": 299990,
   ```
4. Save the file, run `npm run build`, and upload the updated `dist/` directory (or push to Git if auto-deploy is configured).
5. Both the model configurator, the grouped `"от … ₽"` card price, and the `schema.org/Product` structured data update automatically.

---

### 2. How to Add a Product

1. Open `src/data/products.json`.
2. Copy the template object inside `_instructions.exampleProduct` and append it to the `"items"` array (make sure to add a comma `,` after the previous item).
3. Fill in the fields:
   - `"id"`: unique URL-safe slug (e.g. `"iphone-18-pro-256gb-black-esim"`).
   - `"category"`: one of `"iphone"`, `"macbook"`, `"samsung"`, `"watch"`, `"consoles"`.
   - `"modelSlug"`:
     - Use an **existing** `"modelSlug"` (such as `"iphone-18-pro"`) to add a new memory/color/SIM option into that model's configurator automatically.
     - Use a **new** `"modelSlug"` (such as `"ipad-pro-m5"`) to automatically create a brand-new product card and dedicated page at `/catalog/<category>/<modelSlug>/`.
   - `"modelTitle"`: clean model name (e.g. `"iPhone 18 Pro"`).
   - `"title"`: full configuration name (e.g. `"iPhone 18 Pro 256 GB Black eSIM"`).
   - `"price"`: integer price in RUB (e.g. `195990`).
   - `"storage"` / `"storageSlug"`: e.g. `"256 GB"` and `"256gb"` (or `null` if not applicable).
   - `"color"` / `"colorRu"` / `"colorHex"`: e.g. `"Black"`, `"Чёрный"`, `"#1F2024"` (or `null`).
   - `"sim"` / `"simSlug"`: `"SIM + eSIM"` (`"sim-esim"`) or `"eSIM"` (`"esim"`) or `null`.
   - `"imageKey"`: key from `src/data/image-manifest.json` (e.g. `"iphones/iphone-18-pro-black"`), or `null` to show a clean neutral placeholder card.
4. Run `npm run build`.

---

### 3. How to Replace or Add a Product Photo

Source images live in `assets/source/` and optimized AVIF/WebP derivatives are generated into `public/images/`:
- `assets/source/iphones/` — unified same-angle iPhone renders (pure `#FFFFFF` background; recolors are edited from the verified Glacier master render)
- `assets/source/renders/` — clean renders for non-iPhone categories (MacBook, Samsung, Watch, PlayStation) with the same seamless white background
- `assets/source/other-products/` — original legacy source photos (retired from the site; kept for reference)
- `assets/source/news/` — article photos (kept verbatim, shown inside article bodies)
- `assets/source/news-covers/` — clean cropped card covers without baked-in ad text
- `assets/source/brand/` — store logo

**Rules:** every render must show exactly the device being sold, at the same angle/scale/padding as the rest of the catalog. Never reuse a render from another model. If no accurate render exists, set `"imageKey": null` so a clean neutral placeholder is shown instead.

**Steps:**
1. Place the new `.png` or `.jpg` file into the appropriate subfolder (for example, `assets/source/renders/macbook-neo-13-a16.png` for a new photo).
2. Run:
   ```bash
   npm run optimize-images
   ```
   This generates responsive `.avif` and `.webp` files in `public/images/` and updates `src/data/image-manifest.json` with exact `width` and `height` dimensions.
3. If it is a new filename, reference its key (e.g. `"renders/macbook-neo-13-a16"`) in `src/data/products.json` (or set it as the `cover` of a news post).
4. Run `npm run build`.

**Owner-supplied photos (no code changes):** for products waiting on real photos (iPhone 17 Air, iPhone 16 Pro, MacBook Neo 13 A16), the owner can drop a WebP file directly into `public/images/products/` with the exact expected file name — the site picks it up automatically on the next build, and the «Фото уточняется у менеджера» placeholder stays while the file is missing. Check with `npm run images:check`; prep a dropped file locally with `npm run images:prepare -- <input-file> <slug>`. Full step-by-step guide: **[docs/ADDING-PRODUCT-PHOTOS.md](docs/ADDING-PRODUCT-PHOTOS.md)** (English) and **[docs/ДОБАВЛЕНИЕ-ФОТО.md](docs/ДОБАВЛЕНИЕ-ФОТО.md)** (Russian). Expected file names and the waiting list are in `report/images-needed.md`.

---

### 4. How to Add a News Post

1. Copy `src/content/news/_example.md` to a new file in `src/content/news/` **without** a leading underscore — for example:
   `src/content/news/novogodniy-grafik-raboty.md`
2. Put the post image(s) into `assets/source/news/` (for example `assets/source/news/novogodniy-grafik-raboty-1.jpg`) and run `npm run optimize-images`.
3. Edit the frontmatter and Markdown body in your new `.md` file:
   ```markdown
   ---
   title: "График работы магазина в праздничные дни"
   displayTitle: "График работы магазина в праздничные дни"
   cover: "news-covers/novogodniy-grafik-raboty-1-cover"
   seoTitle: "График работы SUPER STORE в ТРЦ РИО в праздники"
   seoDescription: "Актуальное расписание работы офлайн-магазина SUPER STORE в Санкт-Петербурге на улице Фучика, д. 2."
   date: "2026-12-25"
   displayDate: "25-12-2026"
   excerpt: "Рассказываем, как работает магазин в ТРЦ «РИО» в праздничные дни."
   images:
     - "news/novogodniy-grafik-raboty-1"
   ---

   Полный текст новости...
   ```
   *(Keep `seoTitle` and `seoDescription` free of emoji for clean search snippets. `title` keeps the original wording verbatim; `displayTitle` is the cleaned display version shown on cards and headings; `cover` is an optional clean card image without baked-in ad text.)*
4. Run `npm run build`. The post automatically appears on `/`, `/news/`, `/news/novogodniy-grafik-raboty/`, and `/sitemap.xml`.

---

## Design System (Editorial Retail Minimalism, Rebuild 2026-11-25)

- **One light theme.** Dark mode and the header theme toggle were removed entirely — there is no `dark:` styling and no toggle button anywhere.
- **Neutrals:** page `#FFFFFF`, surface `#F7F7F9` (full-bleed alternating bands, product tiles, product photo area), text `#111111`, muted `#6B6B76`, dividers `#E6E6EA` (1px hairlines only).
- **Accent:** violet `#6D28D9` is a small accent only — logo mark, link hover color, focus rings (`:focus-visible`), color-dot selection rings. Never used as a fill, banner or gradient. Buttons are solid `#111111` (hover `#333333`).
- **Type:** self-hosted Manrope (Cyrillic + Latin, weights 400 & 600 only, `public/fonts/*.woff2`, `font-display: swap`, cyrillic woff2 preloaded). Exactly three sizes: display `clamp(38px→66px)` with `line-height: 1.08; letter-spacing: -0.02em`, body `17px` mobile / `18px` desktop, small `14px`. Paragraphs are capped at `60ch` (`.measure`).
- **Layout:** container max `1120px` (`.shell`); section padding `80/140px` (desktop) and `72/128px` for the slim Trade-In band; full-bleed sections alternate `#FFFFFF` / `#F7F7F9` and are separated by whitespace only.
- **Buttons & links:** one filled style (`.btn`, max one per viewport — the homepage has two filled CTAs total, one in the hero and one in the Trade-In band, both prescribed) and one text-arrow link style (`.arrow-link`, hover violet).
- **Product renders:** unified angle/scale; `-f7` variants in `src/data/image-manifest.json` repaint the background to `#F7F7F9` so renders melt into tiles and the product photo area (no inner rectangle, no magnifier, no badges over photos).
- **Motion:** one system — fade + 20px translate on scroll (`[data-reveal]`, 550ms ease-out, IntersectionObserver), gentle staggered hero reveal; `prefers-reduced-motion` disables everything.
- **Anchors:** `scroll-margin-top: 96px` on every `[id]` element so the sticky 64px header never overlaps anchored sections.
- **Homepage is exactly 5 blocks:** header, hero, featured catalog, Trade-In slim band, contacts+map. Everything else (advantages, services grid, FAQ, news preview, review form, SEO paragraphs) lives on subpages.
- **Logo & favicons:** `src/components/Logo.astro` is the single source of the mark (flat `#6D28D9` rounded square, white "S" monogram) — Header uses 28px, Footer 32px. Favicon set: `public/favicon.svg` (same SVG), `favicon-32.png`, `favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180 solid square), declared in `<head>` + `public/site.webmanifest`. `npm run optimize-images` regenerates the flat OG banner (`og-default.jpg`); favicons are static files.
- **Messengers:** icons live once in `src/lib/messenger-icons.ts` (monochrome paths) rendered by `src/components/MessengerIcon.astro` (Astro) / `MESSENGER_PATHS` (Preact). Telegram/WhatsApp/Viber links render in the footer (20px icons), homepage contacts, `/contacts/`, product pages and the Trade-In estimator (18px icons + text).

---

## Hidden UI Elements Pending Owner Data

Elements that require owner-only data are **hidden, never shown as placeholders**. They live in `src/data/site.json` (`legalPlaceholders`, `ownerPending`, `integrations.formEndpoint`) and this checklist:

1. **Telegram** — rendered with the default phone-chat link `https://t.me/+79312020078` (set in `src/data/site.json` → `contacts.messengers.telegram.url`). To swap to a `@username` link anytime, replace that URL with e. g. `https://t.me/superstore_spb` — every Telegram link (footer, homepage contacts, `/contacts/`, product pages, estimator) reads it from that single field. *(The apps helper bot `superstore.arfgift.ru` referenced by the news post is separate and already linked on `/services/data-transfer/`.)*
2. **VK link** — the legacy `vk.com/Apple_SS_178` URL is kept in `site.json` (`contacts.messengers.vk`) but intentionally not rendered; restore the footer button only if the owner confirms that page.
3. **Company legal details** (`[OWNER_COMPANY_NAME]`, `[OWNER_INN]`, `[OWNER_OGRN]`, `[OWNER_LEGAL_ADDRESS]`, `[OWNER_EMAIL]`) — the footer "Реквизиты продавца" line and the `/contacts/` "Реквизиты организации" block are hidden; `/privacy/` and `/terms/` use neutral wording ("реквизиты предоставляются по запросу"). Fill `legalPlaceholders` and re-add the blocks to publish.
4. **Reviews / ratings** — the review form and all review UI were REMOVED entirely (owner decision, 2026-11-25): the `ReviewForm` component, its Metrika goal (`submit_review_form`) and the form-endpoint config no longer exist. Do not re-add reviews or ratings blocks; if the owner revisits this, a new decision is required.
5. **Floor number (`"1 этаж"`)** — not present in verifiable source data; removed from every page and from JSON-LD structured data. Re-add only after owner confirmation.
6. **Real store interior photos & indoor mall floor plan** — not provided; no fake photos or floor-plan graphics are used. Provide real photos to enrich hero/contacts.
7. **Yandex Maps rating line** — the verified rating (`5,0 · 55 отзывов`, as of 2026-11) lives in `site.json` → `contacts.yandexOrg`. The clean text link `★ 5,0 · 55 отзывов на Яндекс Картах →` (homepage contacts + `/contacts/`) and both map links («Открыть…» / «Построить маршрут…») activate the moment the owner pastes the real organization URL into `contacts.yandexOrg.url` (currently the `[YANDEX_ORG_URL]` placeholder — until then the line is hidden and map links keep their previous targets). Update `reviewCount` alongside and bump `asOf`.
8. 7. **Store photos** — the `/contacts/` «Магазин» section renders CSS placeholders until real photos are provided. Drop `store-1.webp … store-4.webp` into `public/images/store/` (dimensions and shooting guide in `report/images-needed.md`); they replace placeholders automatically. Optional per-photo alt/caption live in `src/data/site.json` (`storePhotos`); route hint lives in `contacts.mallDirections` (hidden while empty).

---

## Pre-Launch Owner Configuration Checklist

Before pointing your production domain to the site, fill in these placeholders:

1. **Production Domain (`[OWNER_DOMAIN]`):**
   - Update `site` in `astro.config.mjs` (currently `'https://superstore-rio.ru'`).
   - Update `brand.domain` in `src/data/site.json`.
2. **Company Legal Details (`[OWNER_*]` for Footer, `/privacy/`, `/terms/`):**
   - Open `src/data/site.json` → `"legalPlaceholders"` and fill in `companyName` (ИП/ООО), `inn`, `ogrn`, `legalAddress`, and `privacyEmail`. Until then these blocks stay hidden in the UI (see "Hidden UI Elements Pending Owner Data").
3. **Yandex.Metrika Counter (`[METRIKA_ID]`):**
   - Create a **brand-new** Yandex.Metrika counter for your domain (do not reuse the old constructor counter).
   - Put the numeric counter ID into `src/data/site.json` → `integrations.metrikaId` (e.g. `"98765432"`).
   - Create 6 JavaScript event goals in Yandex.Metrika matching these exact identifiers:
     - `click_phone` — clicks on `+7 (931) 202-00-78` or `+7 (931) 202-00-88`
     - `click_whatsapp` — clicks on general WhatsApp buttons
     - `click_viber` — clicks on Viber buttons
     - `click_check_stock` — clicks on product `"Узнать наличие"` buttons
     - `trade_in_request` — clicks on the Trade-In estimator button «Узнать оценку в WhatsApp» on `/services/#trade-in`
4. **Review Form Delivery (`[EMAIL_OR_TELEGRAM_BOT]`):**
   - Open `src/components/ReviewForm.tsx` and connect your preferred webhook (e.g. a lightweight PHP/Node/Cloud Function endpoint on Timeweb/Yandex Cloud that forwards `{ name, contact, rating, message }` to your store's private Telegram channel via Bot API or email).

---

## Optional: Lazy-Loading a Chat Widget (e.g., JivoSite)

A third-party chat widget is intentionally **excluded** by default to preserve `< 2.5s` mobile LCP and `≥ 90` Lighthouse scores. If you decide to add JivoSite (or Bitrix24 / Carrot quest) later, load it **lazily after the first user interaction** inside `src/layouts/BaseLayout.astro` before `</body>`:

```html
<script is:inline>
  (function () {
    var loaded = false;
    function loadChat() {
      if (loaded) return;
      loaded = true;
      var s = document.createElement('script');
      s.src = 'https://code.jivosite.com/widget/YOUR_WIDGET_ID';
      s.async = true;
      document.body.appendChild(s);
    }
    ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
      window.addEventListener(evt, loadChat, { once: true, passive: true });
    });
  })();
</script>
```

---

## Deployment on Russian Hosting Providers

`npm run build` outputs a pure static directory (`dist/`) that runs on any Russian hosting provider without Node.js runtime requirements in production:

### Option A: Timeweb Cloud (Frontend / Static App)
1. Push the repository to GitHub / GitLab / GitFlic.
2. In Timeweb Cloud → **App Platform → Frontend**, connect the repo:
   - **Build command:** `npm ci && npm run build`
   - **Publish directory:** `dist`
3. Attach your `.ru` domain and enable free Let's Encrypt SSL.

### Option B: Shared Hosting (Reg.ru, Beget, SpaceWeb)
1. Run `npm run build` locally (or in CI).
2. Upload the contents of `dist/` into `public_html/` via SFTP / File Manager.
3. Configure `.htaccess` (Apache) for custom 404:
   ```apache
   ErrorDocument 404 /404.html
   ```

### Option C:Russian VPS with Nginx (Selectel, Timeweb, FirstVDS)
Upload `dist/` to `/var/www/superstore/dist` and use:
```nginx
server {
    listen 80;
    server_name superstore-rio.ru www.superstore-rio.ru;
    root /var/www/superstore/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location /_astro/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /images/ {
        expires 30d;
        add_header Cache-Control "public";
    }

    location / {
        try_files $uri $uri/ =404;
    }

    error_page 404 /404.html;
}
```
