export type LeadRequestType = 'reserve' | 'trade-in' | 'buyback';

export interface LeadModalPayload {
  type: LeadRequestType;
  model?: string | null;
  title?: string | null;
  color?: string | null;
  storage?: string | null;
  sim?: string | null;
  price?: number | null;
  condition?: string | null;
}

declare global {
  interface Window {
    openLeadModal?: (payload: LeadModalPayload, trigger?: HTMLElement | null) => void;
    __SUPERSTORE_CURRENT_PRODUCT__?: LeadModalPayload | null;
  }
}

export function openLeadModal(payload: LeadModalPayload, trigger?: HTMLElement | null): void {
  if (typeof window === 'undefined') return;
  if (typeof window.openLeadModal === 'function') {
    window.openLeadModal(payload, trigger);
  } else {
    window.dispatchEvent(new CustomEvent('superstore:lead-open', { detail: { payload, trigger } }));
  }
}
