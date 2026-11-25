const { nextOccurrence, upcomingOccasions } = require('../../utils/occasions');

const now = new Date('2026-11-24T10:00:00Z');

test('recurring date later this year', () => {
  expect(nextOccurrence('1990-12-01', true, now).toISOString()).toBe('2026-12-01T00:00:00.000Z');
});
test('recurring date already passed moves to next year', () => {
  expect(nextOccurrence('1990-03-15', true, now).toISOString()).toBe('2027-03-15T00:00:00.000Z');
});
test('today counts as upcoming', () => {
  expect(nextOccurrence('2001-11-24', true, now).toISOString()).toBe('2026-11-24T00:00:00.000Z');
});
test('one-off date in the past returns null', () => {
  expect(nextOccurrence('2026-01-01', false, now)).toBeNull();
});
test('upcomingOccasions filters by days and sorts by days left', () => {
  const list = upcomingOccasions([
    { title: 'A', type: 'Birthday', date: '1990-12-20', recurring: true },
    { title: 'B', type: 'Anniversary', date: '2015-11-27', recurring: true },
    { title: 'C', type: 'Birthday', date: '1990-06-01', recurring: true },
  ], 30, now);
  expect(list.map((o) => [o.title, o.daysLeft])).toEqual([['B', 3], ['A', 26]]);
  expect(list[0].giftFinderQuery).toEqual({ occasion: 'Anniversary' });
});
