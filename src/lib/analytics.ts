import siteData from '../data/site.json';

export type MetrikaGoal =
  | 'click_phone'
  | 'click_telegram'
  | 'click_whatsapp'
  | 'click_check_stock'
  | 'trade_in_request'
  | 'lead_open'
  | 'lead_submit_success'
  | 'lead_submit_error';

declare global {
  interface Window {
    ym?: (id: number, action: string, target?: string, params?: Record<string, unknown>) => void;
    __SUPERSTORE_METRIKA_ID__?: number | null;
  }
}

export function trackGoal(goal: MetrikaGoal, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const rawId = siteData.integrations.metrikaId;
  const parsedId = window.__SUPERSTORE_METRIKA_ID__ ?? (/^\d+$/.test(rawId) ? Number(rawId) : null);

  if (parsedId && typeof window.ym === 'function') {
    window.ym(parsedId, 'reachGoal', goal, params);
  } else if (import.meta.env?.DEV) {
    console.debug(`[Metrika stub] reachGoal("${goal}")`, params || {});
  }
}
