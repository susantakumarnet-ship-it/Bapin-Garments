export const inr = (v) =>
  v === null || v === undefined || v === ''
    ? '—'
    : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const num = (v) => Number(v || 0).toLocaleString('en-IN');

export const fmtDate = (v, withTime = false) => {
  if (!v) return '—';
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return new Date(v).toLocaleString('en-IN', opts);
};

export const timeAgo = (v) => {
  const s = Math.floor((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(v);
};

export const STOCK = {
  in_stock: { label: 'In Stock', cls: 'badge-green', dot: 'bg-emerald-500' },
  low_stock: { label: 'Low Stock', cls: 'badge-amber', dot: 'bg-amber-500' },
  out_of_stock: { label: 'Out of Stock', cls: 'badge-red', dot: 'bg-red-500' },
};

export const ENQUIRY_STATUS = {
  New: 'badge-blue',
  Contacted: 'badge-green',
  Pending: 'badge-amber',
  Closed: 'badge-slate',
};

/** Build a WhatsApp click-to-chat URL. */
export function waLink(number, text) {
  const n = String(number || '').replace(/\D/g, '');
  const full = n.length === 10 ? `91${n}` : n;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const absoluteUrl = (path) => `${window.location.origin}${path}`;

export function imgSrc(url, w) {
  if (!url) return PLACEHOLDER;
  if (w && url.includes('images.unsplash.com')) return url.replace(/w=\d+/, `w=${w}`);
  return url;
}

export const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#f1ede6"/><text x="150" y="205" font-family="Georgia" font-size="22" fill="#b9ad97" text-anchor="middle">Bapin Garments</text></svg>',
  );
