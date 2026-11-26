/**
 * Favorites (Избранное) — lazy-loaded after first paint, no server calls.
 * Ids are model ids (`<category>/<modelSlug>`) stored as a JSON array in
 * localStorage; when storage is unavailable the feature keeps working in
 * memory for the session. All motion is transform/opacity only (WAAPI),
 * skipped entirely under reduced/constrained motion.
 */
import { simpleMotion } from '../lib/motion';

const KEY = 'superstore_favorites';
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const desktopFine = () => matchMedia('(min-width: 1024px) and (pointer: fine)').matches;

const store = {
  mem: new Set<string>(),
  ok: true,
  load(): Set<string> {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) this.mem = new Set(parsed.filter((x): x is string => typeof x === 'string'));
      }
    } catch {
      this.ok = false;
    }
    return this.mem;
  },
  save(): void {
    if (!this.ok) return;
    try {
      localStorage.setItem(KEY, JSON.stringify([...this.mem]));
    } catch {
      this.ok = false;
    }
  },
};

const favs = store.load();

function trackAdd(id: string): void {
  try {
    const mid = window.__SUPERSTORE_METRIKA_ID__;
    if (mid && typeof window.ym === 'function') window.ym(mid, 'reachGoal', 'favorite_add', { id });
  } catch {
    /* analytics must never break the feature */
  }
}

function syncButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-fav-btn]').forEach((btn) => {
    const on = favs.has(btn.dataset.favId || '');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Убрать из избранного' : 'Добавить в избранное');
  });
  const n = favs.size;
  document.querySelectorAll('[data-fav-count]').forEach((el) => {
    el.textContent = String(n);
    el.classList.toggle('is-on', n > 0);
  });
  document.querySelectorAll('[data-fav-dot]').forEach((el) => el.classList.toggle('is-on', n > 0));
}

/* ---------- toggle feedback (180 ms pop on add, 120 ms fade on remove) ---------- */

function pop(btn: HTMLElement): void {
  if (simpleMotion()) return;
  btn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.5 }, { transform: 'scale(1)' }],
    { duration: 180, easing: 'ease-out' }
  );
}

function fadeBack(btn: HTMLElement): void {
  if (simpleMotion()) return;
  btn.querySelector('svg')?.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
}

/* ---------- fly-to-header (desktop) / toast + burger dot (mobile) ---------- */

function bumpHeader(): void {
  if (simpleMotion()) return;
  const link = document.querySelector('[data-fav-link]');
  link?.querySelector('svg')?.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.15)', offset: 0.5 }, { transform: 'scale(1)' }],
    { duration: 160, easing: 'ease-out' }
  );
  document.querySelectorAll('[data-fav-count]').forEach((el) =>
    el.animate(
      [{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 200, easing: EASE }
    )
  );
}

function fly(from: HTMLElement): void {
  if (simpleMotion()) return;
  const target = document.querySelector('[data-fav-link]');
  if (!target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const x1 = a.left + a.width / 2;
  const y1 = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - x1;
  const dy = b.top + b.height / 2 - y1;
  const lift = Math.min(64, Math.hypot(dx, dy) * 0.3);
  const dot = document.createElement('span');
  dot.className = 'fav-fly-dot';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  const anim = dot.animate(
    [
      { transform: `translate(${x1 - 5}px, ${y1 - 5}px) scale(1)` },
      { transform: `translate(${x1 + dx / 2 - 5}px, ${y1 + dy / 2 - lift - 5}px) scale(1)` },
      { transform: `translate(${x1 + dx - 5}px, ${y1 + dy - 5}px) scale(0.6)` },
    ],
    { duration: 400, easing: EASE }
  );
  const done = () => {
    dot.remove();
    bumpHeader();
  };
  anim.onfinish = done;
  anim.oncancel = () => dot.remove();
}

let toastTimer = 0;
function toast(): void {
  let el = document.querySelector<HTMLElement>('.fav-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'fav-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = 'Добавлено в избранное';
    document.body.appendChild(el);
  }
  clearTimeout(toastTimer);
  if (!simpleMotion()) {
    el.animate(
      [{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }],
      { duration: 200, easing: 'ease-out', fill: 'forwards' }
    );
  }
  toastTimer = window.setTimeout(() => {
    const node = document.querySelector<HTMLElement>('.fav-toast');
    if (!node) return;
    if (simpleMotion()) {
      node.remove();
      return;
    }
    const out = node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
    out.onfinish = () => node.remove();
    out.oncancel = () => node.remove();
  }, 1600);
  if (!simpleMotion()) {
    document.querySelectorAll('[data-fav-dot]').forEach((el) =>
      el.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.5)', offset: 0.5 }, { transform: 'scale(1)' }],
        { duration: 200, easing: 'ease-out' }
      )
    );
  }
}

/* ---------- favorites page: reveal, removal collapse + FLIP reflow ---------- */

function updateEmpty(): void {
  const grid = document.querySelector('[data-fav-grid]');
  const empty = document.querySelector<HTMLElement>('[data-fav-empty]');
  if (!grid || !empty) return;
  const visible = grid.querySelectorAll('[data-fav-tile]:not([hidden])').length;
  empty.hidden = visible > 0;
}

function initFavoritesPage(): void {
  const grid = document.querySelector('[data-fav-grid]');
  if (!grid) return;
  const tiles = [...grid.querySelectorAll<HTMLElement>('[data-fav-tile]')];
  const visible = tiles.filter((t) => favs.has(t.dataset.favId || ''));
  tiles.forEach((t) => {
    t.hidden = !favs.has(t.dataset.favId || '');
  });
  updateEmpty();
  if (!simpleMotion()) {
    visible.slice(0, 8).forEach((t, i) =>
      t.animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay: i * 60, easing: EASE, fill: 'backwards' }
      )
    );
  }
}

function collapseTile(source: HTMLElement): void {
  const tile = source.closest('[data-fav-tile]') as HTMLElement | null;
  if (!tile) return;
  const grid = tile.closest('[data-fav-grid]') as HTMLElement | null;
  const siblings = grid
    ? [...grid.querySelectorAll<HTMLElement>('[data-fav-tile]:not([hidden])')].filter((t) => t !== tile)
    : [];
  const rects = new Map(siblings.map((t) => [t, t.getBoundingClientRect()]));
  const done = () => {
    tile.hidden = true;
    if (grid && !simpleMotion()) {
      siblings.forEach((t) => {
        const old = rects.get(t);
        if (!old) return;
        const now = t.getBoundingClientRect();
        const dx = old.left - now.left;
        const dy = old.top - now.top;
        if (dx || dy) {
          t.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
            { duration: 200, easing: EASE }
          );
        }
      });
    }
    updateEmpty();
    // Keep keyboard focus inside the grid: next tile, previous tile, or the empty state.
    const next = siblings.find((t) => t.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING);
    const focusTarget = (next || siblings[siblings.length - 1])?.querySelector<HTMLElement>('[data-fav-remove]');
    if (focusTarget) focusTarget.focus();
    else document.querySelector<HTMLElement>('[data-fav-empty]')?.focus();
  };
  if (simpleMotion()) {
    done();
    return;
  }
  const anim = tile.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
    { duration: 200, easing: EASE, fill: 'forwards' }
  );
  anim.onfinish = done;
  anim.oncancel = done;
}

/* ---------- toggle + remove (single delegated listener survives page swaps) ---------- */

function toggle(id: string, btn: HTMLElement): void {
  const adding = !favs.has(id);
  if (adding) {
    favs.add(id);
    trackAdd(id);
  } else {
    favs.delete(id);
  }
  store.save();
  syncButtons();
  if (adding) {
    pop(btn);
    if (desktopFine()) fly(btn);
    else toast();
  } else {
    fadeBack(btn);
    if (btn.closest('[data-fav-grid]')) collapseTile(btn);
  }
}

document.addEventListener('click', (event) => {
  const target = event.target as Element | null;
  if (!target?.closest) return;
  const btn = target.closest<HTMLElement>('[data-fav-btn]');
  if (btn?.dataset.favId) {
    toggle(btn.dataset.favId, btn);
    return;
  }
  const remove = target.closest<HTMLElement>('[data-fav-remove]');
  if (remove) {
    const tile = remove.closest<HTMLElement>('[data-fav-tile]');
    const id = tile?.dataset.favId;
    if (!id) return;
    favs.delete(id);
    store.save();
    syncButtons();
    collapseTile(remove);
  }
});

/* ---------- init + re-sync after client-side navigation / catalog re-renders ---------- */

let scheduled = false;
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    syncButtons();
  });
});

function observe(): void {
  observer.disconnect();
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
}

syncButtons();
initFavoritesPage();
observe();

document.addEventListener('astro:page-load', () => {
  syncButtons();
  initFavoritesPage();
  observe();
});
