# Motion polish report

Date: 2026-11-26 · Branch: `arena/b1d3ac77-test-super`

## Result

Animation-only pass. No product/site data or visible copy changed. Baseline comparison against `2f8d2b2b13f03433fd0e2ffd290479648617bc9b` confirmed identical main-content text and heading/paragraph/image/button geometry on the homepage and flagship product page at **390px and 1440px** (settled/reduced-motion state).

**Mobile Lighthouse: 100 performance / 100 accessibility / 100 best practices / 100 SEO. CLS: 0.** These are local laboratory results, not a field-device guarantee. See the limitations below; strict zero-jank and zero variant-content reflow are not certified.

## Added / adjusted

| Area | Motion |
| --- | --- |
| Shared system | `--dur-fast: 180ms`, `--dur-base: 240ms`, `--dur-reveal: 500ms`, `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`. Animated properties are transform and opacity only. Existing color/background changes are now instant, not animated. |
| Hero | CSS-only 500ms entrances; headline → subline → actions → image at 100ms steps, 20px lift. All content and the priority image remain in server HTML. Initial opacity is 0.1 rather than invisible, including the CSS delay state. JavaScript never hides the LCP. |
| Scroll reveals | IntersectionObserver, headings and actual images only, 500ms / 20px. Only below-viewport content is armed; above-fold content never flashes hidden on hydration. Each DOM element is handled once. MutationObserver handles hydrated/filtered catalog content. No paragraph, card-wrapper, map, or CTA scroll reveals; no text parallax. |
| Product tiles | Fine-pointer hover: exactly -4px tile lift, image scale 1.02. Touch: 0.99 press / opacity feedback, with a brief release and cancellation handling; no sticky hover effect. |
| Configurator | Previous decoded product image fades over the new decoded image in 240ms on storage/color/SIM selections. Price: outgoing -10px fade, incoming +10px fade, 240ms. Decorative absolute snapshots are inert and aria-hidden; live price has a polite announcement. No animation-owned layout space; real selectors retain focus. Rapid changes cancel stale snapshots/animations. CSS time parsing supports production minification from `240ms` to `0.24s`. |
| Header/catalog | Already-solid header stays solid; blur is enabled after 24px. Blur/background are switched, never interpolated. Catalog fades in 180ms. Keyboard focus opens the existing menu; Escape dismisses it without moving focus. |
| Page navigation | Astro ClientRouter with native View Transitions: opacity-only 180ms root fade, no root geometry animation. `fallback="none"`; unsupported browsers still navigate with no simulated page effect. Existing header/cookie/sticky-bar/estimator scripts now initialize on Astro page loads. Observers/RAF/listeners are cleaned up before navigation. |
| Smooth scrolling | Lenis is dynamically imported only after two animation frames and only for `(pointer: fine)` plus viewport ≥1024px. Touch uses native scrolling. Preference/media-query changes destroy the Lenis instance and RAF loop. Native anchor and focus scrolling are retained. |
| Reduced/constrained motion | Reduced motion, Save-Data, reported memory ≤4GB, or ≤4 logical processors: instant hero/reveal states, no Lenis, no configurator effects, no decorative tile transforms or page fade. The early capability hint changes no content visibility. Functional transforms, such as the hidden sticky contact bar, remain functional. |

## Verification

- `npm run build`: passed; 34 static pages and image checks.
- `npm run verify-data`: passed; unchanged 30 products, contacts, hours, five news articles, and generated HTML metadata checks.
- `git diff --check`: passed.
- Browser regression suite: **32 checks passed**, zero captured browser errors. See [verification.json](verification.json).
- Keyboard: skip link, catalog focus/Escape, selection focus, mobile dialog focus trap and focus restoration.
- Effects: exact hover lift/scale, one-time heading reveals, no paragraph reveals, storage/color crossfade snapshots, rapid updates, touch press and release, reduced motion, Save-Data, low-end hints, SPA navigation/back, unsupported View Transitions.
- Image/price x/y/height remained stable through storage/color selections. Baseline geometry checks covered home and product at both widths.

### Performance and JavaScript

| Measurement | Latest result |
| --- | ---: |
| Lighthouse mobile performance | **100** |
| Lighthouse LCP | 1.580s |
| Lighthouse TBT | 9ms |
| Lighthouse CLS | **0** |
| Observed homepage CLS, desktop/mobile | **0 / 0** |
| Homepage executable JS, gzip, including inline scripts and deferred desktop Lenis | **15,221 bytes (14.9 KiB)** |
| Required initial homepage JS ceiling | ≤150 KiB gzip |

The JS calculation counts actual first-homepage script resources and inline executable scripts, not JSON-LD or HTML. The figure conservatively includes Lenis even though it is deferred and absent on touch/constrained devices. GSAP is not installed; CSS, IntersectionObserver and Web Animations cover the required effects at lower cost.

Lighthouse used its standard simulated-mobile settings. The separate Performance trace deliberately forced a capable-device hint so that the full reveal path was tested under **4× CPU throttling, 390×844 touch viewport, 150ms latency, 1.6Mbps download and 750Kbps upload**. It used headless Chromium with software rendering, not a physical phone.

### Trace review and remaining limits

- [Compressed Chrome Performance trace](mobile-performance-trace.json.gz) includes loading, menu interaction, marked `motion-scroll-start` / `motion-scroll-end`, scroll reveals, and touch press feedback.
- Scroll frame samples: median **16.7ms**, p95 **33.4ms**, maximum **66.7ms**; **two frames exceeded 50ms**. Five >50ms tasks occurred in the full trace, one within the marked scroll window (**50.1ms**, dominated by subframe/window-context initialization).
- Consequently, **strict zero-jank is not claimed**. Trace overhead/software rendering and existing lazy subframes contribute; a physical-device follow-up is warranted. No out-of-scope iframe/content changes were made to improve the trace artificially.
- **Existing configurator content reflow remains:** some variants insert/remove `current.note` above the selectors. At 1440px, changing the initial flagship configuration to 512GB moves the memory group from y=544.516 to y=609.484 (**64.969px**) in both the original commit and this implementation. This is pre-existing content-driven reflow, not the new image/price animation. Reserving note space would change the layout, so it was intentionally not done under the scope lock. Standard CLS excludes shifts soon after user input, so CLS=0 must not be read as a claim that this selector reflow does not exist.
- Metrics vary by run; earlier runs scored 99–100 performance. The saved artifacts correspond to the latest completed run.

## Skipped effects

1. **Lead modal open/close and success fade:** there is no lead modal, lead form, or associated success state in this checkout. Only a mobile-navigation dialog exists. Adding a new lead interface would violate the no-layout/no-copy/no-data scope lock; it was not invented, and the mobile menu was not misrepresented as a lead modal.
2. **GSAP:** unnecessary for these effects; omitted to protect the JS budget.
3. **Unsupported-browser page animations:** intentionally none, as requested.
4. **Parallax/body-copy reveals:** intentionally none.
5. **Video:** screenshots were chosen for the requested screenshots/video evidence. The browser Performance trace also contains screenshots; no standalone video was produced.

## Saved visual evidence

- [Hero entrance](hero-entrance.png), [settled hero](hero-settled.png), [mobile hero](hero-mobile.png)
- [Tile hover](tile-hover.png), [touch press](tile-touch-press.png)
- [Configurator before](configurator-before.png), [storage transition](configurator-storage-mid.png), [color transition](configurator-color-mid.png), [configurator after](configurator-after.png)
- [Lighthouse HTML report](lighthouse-mobile.html), [Lighthouse JSON](lighthouse-mobile.json)
- [Browser verification/measurements](verification.json), [Performance trace](mobile-performance-trace.json.gz)

To inspect the trace, decompress it and import the resulting JSON in Chrome DevTools → Performance.

## Reproduce

```sh
npm ci
npm run build
npm run preview
# In another shell (with the preview running):
node scripts/verify-motion.mjs
# Or build + verify against an already-running preview:
npm run verify:motion
```

Optional environment variables: `MOTION_URL` (defaults to `http://localhost:4321`), `CHROME_PATH` (use an installed Chrome), `BASELINE_URL` (compare original-build text and geometry). The checked-in test script can use the npm-packaged headless Chromium and its bundled Linux NSS libraries, avoiding a separate browser download. Baseline testing used a git archive of the original commit in an ignored cache directory; no branch switch was made.
