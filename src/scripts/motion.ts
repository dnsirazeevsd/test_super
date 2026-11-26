/** Lifecycle-owned motion: no GSAP needed for compositor-only effects. */
import type Lenis from 'lenis';
import { simpleMotion } from '../lib/motion';

type DeviceNavigator = Navigator & {
  connection?: EventTarget & { saveData?: boolean };
  deviceMemory?: number;
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 1024px) and (pointer: fine)');
let teardown = () => {};
function initMotion() {
  teardown();
  let disposed = false;
  let observer: IntersectionObserver | undefined;
  let mutation: MutationObserver | undefined;
  let lenis: Lenis | undefined;
  let frame = 0;
  let scrollFrame = 0;
  let generation = 0;
  const seen = new WeakSet<Element>();
  let pressed: HTMLElement | undefined;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  const clearPress = () => {
    clearTimeout(pressTimer);
    pressed?.classList.remove('is-pressed'); pressed = undefined;
  };
  const press = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || simpleMotion()) return;
    clearPress();
    pressed = (event.target as Element).closest<HTMLElement>('.product-tile') || undefined;
    pressed?.classList.add('is-pressed');
  };
  const release = () => {
    // A tap gets a perceptible short response even when :active ends in one frame.
    pressTimer = setTimeout(clearPress, 120);
  };
  document.addEventListener('pointerdown', press, { passive: true });
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', clearPress, { passive: true });
  const header = document.querySelector('[data-header]');
  const updateHeader = () => {
    scrollFrame = 0;
    header?.classList.toggle('is-scrolled', scrollY > 24);
  };
  const onScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeader); };
  updateHeader();
  addEventListener('scroll', onScroll, { passive: true });

  const scan = () => {
    document.querySelectorAll<HTMLElement>('main h1, main h2, main h3, main img').forEach(el => {
      if (seen.has(el) || el.closest('#hero, .config-image, .config-snapshot, .config-thumbs, dialog')) return;
      seen.add(el);
      // Only offscreen elements are ever armed; hydration never flashes visible text.
      if (el.getBoundingClientRect().top <= innerHeight + 24) return;
      el.classList.add('reveal-pending', 'reveal-ready');
      observer?.observe(el);
    });
  };
  const configure = async () => {
    const version = ++generation;
    const simple = simpleMotion();
    document.documentElement.classList.toggle('motion-simple', simple);
    observer?.disconnect();
    mutation?.disconnect();
    document.querySelectorAll('.reveal-pending').forEach(el => el.classList.remove('reveal-pending'));
    lenis?.destroy(); lenis = undefined;
    if (!simple && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
            entry.target.classList.remove('reveal-pending');
            observer?.unobserve(entry.target);
          }
        });
      }, { threshold: 0.01, rootMargin: '0px 0px 24px 0px' });
      scan();
      // Covers Preact hydration/filter results without observing style mutations.
      mutation = new MutationObserver(scan);
      mutation.observe(document.querySelector('main')!, { childList: true, subtree: true });
    }
    if (simple || !desktop.matches) return;
    const { default: SmoothScroll } = await import('lenis');
    if (disposed || version !== generation || simpleMotion() || !desktop.matches) return;
    lenis = new SmoothScroll({ autoRaf: false, smoothWheel: true, syncTouch: false, autoToggle: false });
    // No permanent RAF loop on native scrolling devices.
    const tick = (time: number) => {
      if (!lenis || disposed) return;
      lenis.raf(time);
      frame = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  };
  const change = () => { void configure(); };
  reduced.addEventListener('change', change);
  desktop.addEventListener('change', change);
  (navigator as DeviceNavigator).connection?.addEventListener('change', change);
  // Two RAFs guarantee a first paint before optional library import / reveal work.
  frame = requestAnimationFrame(() => { frame = requestAnimationFrame(change); });
  const focus = (event: FocusEvent) => {
    const el = event.target as HTMLElement;
    el.classList?.remove('reveal-pending');
    observer?.unobserve(el);
  };
  document.addEventListener('focusin', focus);
  teardown = () => {
    disposed = true; generation++;
    clearPress();
    document.removeEventListener('pointerdown', press);
    document.removeEventListener('pointerup', release);
    document.removeEventListener('pointercancel', clearPress);
    cancelAnimationFrame(frame); cancelAnimationFrame(scrollFrame);
    observer?.disconnect(); mutation?.disconnect(); lenis?.destroy();
    removeEventListener('scroll', onScroll);
    reduced.removeEventListener('change', change); desktop.removeEventListener('change', change);
    (navigator as DeviceNavigator).connection?.removeEventListener('change', change);
    document.removeEventListener('focusin', focus);
  };
}
document.addEventListener('astro:page-load', initMotion);
document.addEventListener('astro:before-swap', () => teardown());
