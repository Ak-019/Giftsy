const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DAY_MS = 24 * 60 * 60 * 1000;

// Midnight UTC of the given date
const startOfDayUTC = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);

// "YYYY-MM-DD" for a date in the given time zone
const dayKey = (d, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const paginate = (page, limit, total) => ({ page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) });

module.exports = { round2, escapeRegex, escapeHtml, DAY_MS, startOfDayUTC, addDays, dayKey, paginate };
