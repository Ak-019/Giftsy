const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const money = (n) => inr.format(Number(n || 0));

export const date = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-IN', opts) : '';
export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

// "2026-11-24" for <input type="date">
export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const discountPercent = (price, finalPrice) =>
  finalPrice < price ? Math.round(((price - finalPrice) / price) * 100) : 0;

// Only allow redirects to paths inside this site ("/cart"), never "//evil.com" or "/\evil.com"
export function safeRedirect(path, fallback = '/') {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback;
  return path;
}
