import { useLayoutEffect, useRef } from 'preact/hooks';
import { simpleMotion } from './motion';

/** DOM snapshots are decorative only. Preact keeps ownership of the real content/focus. */
export function useConfiguratorMotion(selection: string) {
  const imageRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLParagraphElement>(null);
  const pending = useRef<{ image?: HTMLElement; price?: HTMLElement; text?: string }>({});
  const animations = useRef<Animation[]>([]);
  const version = useRef(0);
  const clear = () => {
    version.current++;
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    pending.current.image?.remove(); pending.current.price?.remove(); pending.current = {};
  };
  const snapshot = (element?: Element | null) => {
    if (!element) return;
    const clone = element.cloneNode(true) as HTMLElement;
    clone.classList.add('config-snapshot');
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    return clone;
  };
  const prepareChange = () => {
    clear();
    if (simpleMotion()) return;
    const image = snapshot(imageRef.current?.querySelector('picture'));
    const price = snapshot(priceRef.current?.firstElementChild);
    if (image) imageRef.current?.append(image);
    if (price) priceRef.current?.append(price);
    pending.current = { image, price, text: price?.textContent || '' };
  };
  useLayoutEffect(() => {
    const token = version.current;
    const { image, price, text } = pending.current;
    if (!image && !price) return;
    const style = getComputedStyle(document.documentElement);
    const time = style.getPropertyValue('--dur-base').trim();
    const duration = (parseFloat(time) * (time.endsWith('ms') ? 1 : 1000)) || 240;
    const easing = style.getPropertyValue('--ease-out').trim();
    const play = (el: HTMLElement, frames: Keyframe[], done?: () => void) => {
      const animation = el.animate(frames, { duration, easing });
      animations.current.push(animation);
      animation.finished.then(() => { animation.cancel(); done?.(); }, () => {});
    };
    const livePrice = priceRef.current?.firstElementChild as HTMLElement;
    if (price && livePrice && text !== livePrice.textContent) {
      play(price, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }], () => price.remove());
      play(livePrice, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }]);
    } else price?.remove();
    if (image) {
      // Keep the previous decoded render over the new image until it is ready.
      const img = imageRef.current?.querySelector('picture:not(.config-snapshot) img') as HTMLImageElement | null;
      const ready = img?.decode().catch(() => {}) || Promise.resolve();
      void ready.then(() => {
        if (version.current !== token) return;
        if (simpleMotion()) { clear(); return; }
        play(image, [{ opacity: 1 }, { opacity: 0 }], () => image.remove());
      });
    }
  }, [selection]);
  useLayoutEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { if (simpleMotion()) clear(); };
    preference.addEventListener('change', change);
    return () => { preference.removeEventListener('change', change); clear(); };
  }, []);
  return { imageRef, priceRef, prepareChange };
}
