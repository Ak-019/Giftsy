import { describe, expect, test } from 'vitest';
import { discountPercent, money, plural, safeRedirect } from '../src/utils/format';

describe('safeRedirect blocks open redirects', () => {
  test.each([
    ['/cart', '/cart'], ['/product/a?x=1', '/product/a?x=1'],
    ['//evil.com', '/'], ['/\\evil.com', '/'], ['https://evil.com', '/'], ['javascript:alert(1)', '/'], [null, '/'],
  ])('%s -> %s', (input, expected) => expect(safeRedirect(input)).toBe(expected));
});

test('money formats rupees the Indian way', () => {
  expect(money(123456)).toBe('₹1,23,456');
  expect(money(99.5)).toBe('₹99.5');
});

test('discountPercent and plural', () => {
  expect(discountPercent(1000, 750)).toBe(25);
  expect(discountPercent(500, 500)).toBe(0);
  expect(plural(1, 'item')).toBe('1 item');
  expect(plural(3, 'item')).toBe('3 items');
});
