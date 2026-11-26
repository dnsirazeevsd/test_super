const buckets = new Map();
const MAX_BYTES = 4096;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const LABELS = { reserve: 'Бронирование', 'trade-in': 'Trade-In', buyback: 'Выкуп' };

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  Vary: 'Origin',
});

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGIN || '').replace(/\/$/, '');
    const origin = (req.headers.get('Origin') || '').replace(/\/$/, '');
    if (!allowed || origin !== allowed) return new Response('Forbidden', { status: 403 });
    const headers = { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return new Response('{"error":"method"}', { status: 405, headers });

    const raw = await req.text();
    if (raw.length > MAX_BYTES) return new Response('{"error":"too_large"}', { status: 413, headers });

    const ip = req.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const now = Date.now();
    const hits = (buckets.get(ip) || []).filter((t) => now - t < WINDOW_MS);
    if (hits.length >= MAX_PER_IP) return new Response('{"error":"rate_limit"}', { status: 429, headers });
    hits.push(now);
    buckets.set(ip, hits);
    if (buckets.size > 2000) buckets.delete(buckets.keys().next().value);

    let data;
    try { data = JSON.parse(raw); } catch { return new Response('{"error":"json"}', { status: 400, headers }); }

    const name = String(data.name || '').trim();
    const phone = String(data.phone || '').trim();
    const type = LABELS[data.type] ? data.type : null;
    if (
      data.website ||
      Number(data.elapsedMs || 0) < 1200 ||
      data.consent !== true ||
      !type ||
      !name || name.length > 80 ||
      !/^\+7\d{10}$/.test(phone)
    ) {
      return new Response('{"error":"invalid"}', { status: 400, headers });
    }

    const ts = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'medium',
    }).format(new Date(now));

    const text = [
      `<b>Заявка с сайта SUPER STORE</b>`,
      `<b>Тип:</b> ${esc(LABELS[type])}`,
      `<b>Параметры:</b> ${esc(String(data.specs || '—').slice(0, 300))}`,
      `<b>Цена:</b> ${esc(String(data.price || '—').slice(0, 60))}`,
      `<b>Получение:</b> ${esc(String(data.receiving || '—').slice(0, 200))}`,
      `<b>Имя:</b> ${esc(name)}`,
      `<b>Телефон:</b> ${esc(data.phoneFormatted || phone)}`,
      `<b>Страница:</b> ${esc(String(data.pageUrl || '—').slice(0, 300))}`,
      `<b>Время (МСК):</b> ${esc(ts)}`,
    ].join('\n');

    const tg = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!tg.ok) return new Response('{"error":"upstream"}', { status: 502, headers });
    return new Response('{"ok":true}', { status: 200, headers });
  },
};
