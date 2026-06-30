const config = require('../config');

const SUPABASE_URL = config.supabaseUrl;
const SUPABASE_KEY = config.supabaseServiceKey;

async function supabaseFetch(method, table, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${options.query || ''}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${text}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return null;
}

// Translate Telegram user ID to Supabase user_id for storage.
// If SUPABASE_USER_ID is configured, all data is stored under that UUID
// so RLS policies (auth.uid() = user_id) work when viewed from Folio.
function dataUserId(telegramUserId) {
  return config.supabaseUserId || telegramUserId;
}

module.exports = { dataUserId,
  select(table, { select: cols = '*', match = {}, order, range, extraQuery } = {}) {
    const params = new URLSearchParams();
    params.set('select', cols);
    Object.entries(match).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        const op = (typeof v === 'string' && v.startsWith('eq.')) ? '' : 'eq.';
        params.set(k, op + v);
      }
    });
    if (order) params.set('order', order);
    if (range) params.set('offset', String(range.offset || 0));
    let q = `?${params.toString()}`;
    if (extraQuery) q += extraQuery;
    return supabaseFetch('GET', table, { query: q });
  },

  insert(table, data, { upsert } = {}) {
    const headers = upsert ? { Prefer: 'resolution=merge-duplicates' } : {};
    return supabaseFetch('POST', table, { body: Array.isArray(data) ? data : [data], headers });
  },

  update(table, match, data) {
    const params = new URLSearchParams();
    Object.entries(match).forEach(([k, v]) => params.set(`${k}`, `eq.${v}`));
    return supabaseFetch('PATCH', table, { query: `?${params.toString()}`, body: data });
  },

  delete(table, match) {
    const params = new URLSearchParams();
    Object.entries(match).forEach(([k, v]) => params.set(`${k}`, `eq.${v}`));
    return supabaseFetch('DELETE', table, { query: `?${params.toString()}` });
  },
};
