# Adding product photos

This guide explains how to put real product photos on the site without touching any
code. A photo only needs to be dropped into the right folder with the right file name —
the site picks it up automatically on the next build.

Until a photo is in place, the product shows the neutral placeholder
**«Фото уточняется у менеджера»** ("Photo to be confirmed with the manager"). That is
expected and safe: the site never shows an image that does not match the product.

## 1. Prepare the photo

Each product photo must meet these requirements:

- **Format:** WebP. AVIF is optional but not required.
- **Ratio:** portrait **4:5**, exactly **1600 × 2000 px**.
- **Composition:** the device centered with even margins on all sides.
- **Background:** transparent **or** a uniform **#F7F7F9** (light gray) — no borders,
  no boxes around the device.
- **No text, no watermarks** on the image.
- **File size:** ≤ 300 KB.

Two ways to prepare a photo:

- **Free browser tool:** [Squoosh](https://squoosh.app) — open the photo, set the
  output size to 1600 × 2000 px, pick WebP, and export.
- **The built-in script (local only, no network):**

  ```bash
  npm run images:prepare -- <input-file> <slug>
  ```

  Example — the owner drops a photo of the iPhone 17 Air:

  ```bash
  npm run images:prepare -- ./photos/iphone-17-air.jpg iphone-17-air-space-black-front
  ```

  The script resizes the source to fit 1600 × 2000 (4:5, centered, on #F7F7F9 — or
  keeping transparency if the source has an alpha channel), converts it to WebP at
  quality ~82 and writes it to `public/images/products/<slug>.webp`. It only resizes
  locally: no retouching, no network access.

## 2. File naming

Rules:

- lowercase letters and digits only,
- words separated by hyphens (`-`), no spaces or underscores,
- exact slug from the table below.

Current products that are waiting for photos:

| Product | Exact file name |
| :--- | :--- |
| iPhone 17 Air (Space Black) | `iphone-17-air-space-black-front.webp` |
| iPhone 16 Pro | `iphone-16-pro-front.webp` |
| MacBook Neo 13 A16 | `macbook-neo-13-a16-front.webp` |

Pattern for any product: **`{model-slug}-{color-slug}-front.webp`**

- `model-slug` — the product's model slug, e.g. `iphone-17-air`, `macbook-neo-13-a16`.
- `color-slug` — the color in lowercase with hyphens, e.g. `space-black`. If the
  product has no color variants, omit the color part (e.g. `iphone-16-pro-front.webp`).
- `front` — the front view. Additional angles use a suffix instead:
  `-back`, `-side`, `-detail` (e.g. `iphone-17-air-space-black-back.webp`).

## 3. Where to put the file

Drop the file into:

```
public/images/products/
```

For example: `public/images/products/iphone-17-air-space-black-front.webp`.

## 4. Check that the file is detected

Run:

```bash
npm run images:check
```

It prints every expected product photo and whether it was found. You should see a `✓`
next to the file you just added. The same check runs automatically at the end of
`npm run build` as a warning.

## 5. Products with several colors

If a product is sold in several colors, each color needs its own photo with its own
color slug in the file name:

- `iphone-17-air-space-black-front.webp`
- `iphone-17-air-midnight-front.webp`
- ...

The storefront shows the photo that matches the selected color. If a color has no
photo yet, the placeholder stays for that color only — other colors keep working.

## 6. Rebuild and deploy

```bash
npm run build
```

Then deploy as described in `README.md` (the usual deploy steps), or let the hosting
auto-build handle it if it is configured. The photo appears after the build that
includes the file.

## 7. How to verify

1. Open the **catalog** (`/catalog/`) and the **product page**
   (`/catalog/<category>/<model>/`).
2. Check at **375 px** (phone) and **1440 px** (desktop).
3. The placeholder must be gone — the real photo is shown.
4. Look at the photo: it must not be stretched, squished or cut off. If it is, the
   file probably has the wrong ratio (see troubleshooting).

## 8. Troubleshooting

- **The placeholder still shows.** Check, in this order:
  1. the file name is exactly as required (lowercase, hyphens, correct slug);
  2. the file is in `public/images/products/`, not somewhere else;
  3. you rebuilt after adding the file (`npm run build`);
  4. the browser cache — hard refresh (Ctrl/Cmd + Shift + R).
- **The image is blurry.** The source was too small — the file must be 1600 × 2000 px
  (or larger before resizing). Re-export at full size.
- **The image is cropped or stretched.** The ratio is wrong — the photo must be 4:5
  (1600 × 2000). Re-export with the correct ratio; the site shows the file as-is.
- **The page got slow.** The file is too large — keep it under 300 KB. Re-export with
  a lower WebP quality.

## 9. Extra angles (gallery), replacing and removing

- **More angles:** add files with the suffixes `-back`, `-side`, `-detail`
  (e.g. `iphone-17-air-space-black-back.webp`). The gallery picks them up
  automatically.
- **Replace a photo:** put the new file with the same name over the old one and
  rebuild. No code changes needed.
- **Remove a photo:** delete the file from `public/images/products/` and rebuild —
  the placeholder comes back automatically.

Questions about a specific product? Check the exact expected file name in
`src/data/images.json` (the `products` section) or run `npm run images:check`.
