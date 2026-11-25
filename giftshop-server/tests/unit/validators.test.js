const v = require('../../validators');

test('register strips unknown fields such as role and normalises email', () => {
  const r = v.auth.register.parse({ name: ' Asha ', email: ' ASHA@Mail.com ', password: 'secret1', role: 'admin' });
  expect(r).toEqual({ name: 'Asha', email: 'asha@mail.com', password: 'secret1' });
});

test('order body drops client-sent prices', () => {
  const r = v.order.create.parse({ addressId: 'a'.repeat(24), total: 1, subtotal: 1, items: [{ price: 1 }] });
  expect(r.total).toBeUndefined();
  expect(r.items).toBeUndefined();
  expect(r.paymentMethod).toBe('COD');
});

test('order needs an address', () => {
  expect(v.order.create.safeParse({}).success).toBe(false);
});

test('product list query parses comma lists, numbers and booleans', () => {
  const r = v.product.listQuery.parse({ category: 'Mugs, Toys', maxPrice: '1000', inStock: 'true' });
  expect(r).toMatchObject({ category: ['Mugs', 'Toys'], maxPrice: 1000, inStock: true, page: 1, limit: 12 });
});

test('product create rejects discount >= price and unknown occasions', () => {
  const base = { name: 'Mug', description: 'A very nice mug', price: 100, category: 'Mugs', stock: 1 };
  expect(v.product.create.safeParse({ ...base, discountPrice: 100 }).success).toBe(false);
  expect(v.product.create.safeParse({ ...base, occasions: ['Halloween'] }).success).toBe(false);
  expect(v.product.create.safeParse(base).success).toBe(true);
});

test('coupon code is upper-cased; percent over 100 rejected', () => {
  const base = { code: 'save10', type: 'percent', value: 10, expiresAt: new Date(Date.now() + 86400000).toISOString() };
  expect(v.coupon.create.parse(base).code).toBe('SAVE10');
  expect(v.coupon.create.safeParse({ ...base, value: 150 }).success).toBe(false);
});

test('address checks phone and pincode', () => {
  const a = { fullName: 'A B', phone: '12345', line1: 'Street 1', city: 'Pune', state: 'MH', pincode: '41100' };
  const r = v.account.addressCreate.safeParse(a);
  expect(r.success).toBe(false);
  expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(['phone', 'pincode']);
});

test('update schemas never inject defaults (a partial update must not reset other fields)', () => {
  expect(v.product.update.parse({ price: 10 })).toEqual({ price: 10 });
  expect(v.account.occasionUpdate.parse({ note: 'hi' })).toEqual({ note: 'hi' });
  expect(v.account.addressUpdate.parse({ city: 'Pune' })).toEqual({ city: 'Pune' });
  expect(v.coupon.update.parse({ value: 5 })).toEqual({ value: 5 });
});

test('create schemas still apply defaults', () => {
  const o = v.account.occasionCreate.parse({ title: 'Mom', date: '2020-01-01' });
  expect(o).toMatchObject({ type: 'Birthday', recurring: true });
  const p = v.product.create.parse({ name: 'Mug', description: 'A very nice mug', price: 100, category: 'Mugs', stock: 1 });
  expect(p).toMatchObject({ occasions: [], variants: [], isFeatured: false });
});

test('oversized arrays are rejected', () => {
  const items = Array.from({ length: 201 }, () => ({ id: 'a'.repeat(24), stock: 1 }));
  expect(v.product.bulkStock.safeParse({ items }).success).toBe(false);
});
