import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small fetch wrapper. Session is an httpOnly cookie, so no tokens are ever
 * stored in JavaScript. The X-Requested-With header is required by the
 * server's CSRF guard on state-changing requests.
 */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers,
    body: form ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Always surface readable text, whatever shape the error body has.
    const raw = typeof data.error === 'string' ? data.error : data.error?.message || data.message;
    const message =
      raw ||
      (res.status >= 500 ? 'The store server is not responding right now. Please try again in a moment.' : `Request failed (${res.status})`);
    const err = new Error(message);
    err.status = res.status;
    err.fields = data.fields;
    if (res.status === 401 && path.startsWith('/admin')) window.dispatchEvent(new Event('bg:unauthorized'));
    throw err;
  }
  return data;
}

export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Data-fetching hook with loading/error state and manual reload. */
export function useApi(path, { skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: null });
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (skip || !path) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path);
      if (id === seq.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === seq.current) setState({ data: null, loading: false, error });
    }
  }, [path, skip]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}
