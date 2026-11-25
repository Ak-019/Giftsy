const { DAY_MS, startOfDayUTC } = require('./helpers');

// Next date an occasion happens. Recurring ones (birthdays) repeat every year.
function nextOccurrence(date, recurring = true, now = new Date()) {
  const today = startOfDayUTC(now);
  const d = new Date(date);
  if (!recurring) {
    const once = startOfDayUTC(d);
    return once >= today ? once : null;
  }
  let next = new Date(Date.UTC(today.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (next < today) next = new Date(Date.UTC(today.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
  return next;
}

function upcomingOccasions(occasions, days = 30, now = new Date()) {
  const today = startOfDayUTC(now);
  return occasions
    .map((o) => {
      const plain = typeof o.toObject === 'function' ? o.toObject() : o;
      const nextDate = nextOccurrence(plain.date, plain.recurring !== false, now);
      if (!nextDate) return null;
      const daysLeft = Math.round((nextDate - today) / DAY_MS);
      // giftFinderQuery lets the frontend jump straight to matching gifts
      return { ...plain, nextDate, daysLeft, giftFinderQuery: { occasion: plain.type } };
    })
    .filter((o) => o && o.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

module.exports = { nextOccurrence, upcomingOccasions };
