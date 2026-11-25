const { app, request, createUser, createAdmin, createProduct } = require('../helpers');
const Product = require('../../models/Product');
const User = require('../../models/User');

const base = { name: 'Photo Mug', description: 'A lovely photo mug', price: 400, category: 'Mugs', stock: 5 };

describe('products (admin)', () => {
  test('create: slug is unique, finalPrice uses discount, protected fields are ignored', async () => {
    const { auth } = await createAdmin();
    const a = await request(app).post('/api/products').set(auth).send({ ...base, discountPrice: 350, ratingAvg: 5, soldCount: 999 });
    expect(a.status).toBe(201);
    expect(a.body.product).toMatchObject({ slug: 'photo-mug', finalPrice: 350, ratingAvg: 0, soldCount: 0 });

    const b = await request(app).post('/api/products').set(auth).send(base);
    expect(b.body.product.slug).toBe('photo-mug-2');
  });

  test('customers cannot create, update or delete products', async () => {
    const { auth } = await createUser();
    const p = await createProduct();
    expect((await request(app).post('/api/products').set(auth).send(base)).status).toBe(403);
    expect((await request(app).put(`/api/products/${p._id}`).set(auth).send({ price: 1 })).status).toBe(403);
    expect((await request(app).delete(`/api/products/${p._id}`).set(auth)).status).toBe(403);
  });

  test('discount must be lower than price, on create and on update', async () => {
    const { auth } = await createAdmin();
    expect((await request(app).post('/api/products').set(auth).send({ ...base, discountPrice: 500 })).status).toBe(400);
    const p = await createProduct({ price: 400 });
    const res = await request(app).put(`/api/products/${p._id}`).set(auth).send({ discountPrice: 450 });
    expect(res.status).toBe(400);
  });

  test('update renames the slug and recalculates finalPrice', async () => {
    const { auth } = await createAdmin();
    const p = await createProduct({ name: 'Old Name', price: 600 });
    const res = await request(app).put(`/api/products/${p._id}`).set(auth).send({ name: 'New Name', discountPrice: 500 });
    expect(res.body.product).toMatchObject({ slug: 'new-name', finalPrice: 500 });
  });

  test('delete also removes it from wishlists', async () => {
    const { auth } = await createAdmin();
    const p = await createProduct();
    const { user } = await createUser({ wishlist: [p._id] });
    await request(app).delete(`/api/products/${p._id}`).set(auth).expect(200);
    expect((await User.findById(user._id)).wishlist).toHaveLength(0);
  });

  test('bulk stock update', async () => {
    const { auth } = await createAdmin();
    const [p1, p2] = await Promise.all([createProduct(), createProduct()]);
    const res = await request(app).patch('/api/admin/products/stock').set(auth)
      .send({ items: [{ id: String(p1._id), stock: 0 }, { id: String(p2._id), stock: 42 }] });
    expect(res.body.modified).toBe(2);
    expect((await Product.findById(p2._id)).stock).toBe(42);
  });
});

describe('products (shop)', () => {
  beforeEach(async () => {
    await createProduct({ name: 'Cheap Card', category: 'Cards', price: 150, occasions: ['Wedding'], recipients: ['Couples'] });
    await createProduct({ name: 'Fancy Wallet', category: 'Accessories', price: 1500, discountPrice: 900, occasions: ['Birthday'], recipients: ['For Him'] });
    await createProduct({ name: 'Big Teddy', category: 'Toys', price: 1200, occasions: ['Birthday'], recipients: ['Kids'], stock: 0 });
  });

  const names = (res) => res.body.products.map((p) => p.name);

  test('filters by occasion, category list, price (after discount) and stock', async () => {
    expect(names(await request(app).get('/api/products?occasion=Birthday')).sort()).toEqual(['Big Teddy', 'Fancy Wallet']);
    expect(names(await request(app).get('/api/products?category=Cards,Toys')).sort()).toEqual(['Big Teddy', 'Cheap Card']);
    expect(names(await request(app).get('/api/products?maxPrice=1000&sort=priceAsc'))).toEqual(['Cheap Card', 'Fancy Wallet']);
    expect(names(await request(app).get('/api/products?occasion=Birthday&inStock=true'))).toEqual(['Fancy Wallet']);
  });

  test('pagination', async () => {
    const res = await request(app).get('/api/products?sort=priceAsc&limit=1&page=2');
    expect(res.body).toMatchObject({ total: 3, pages: 3, page: 2 });
    expect(names(res)).toEqual(['Fancy Wallet']);
  });

  test('text search and search suggestions', async () => {
    expect(names(await request(app).get('/api/products?search=wallet'))).toEqual(['Fancy Wallet']);
    expect(names(await request(app).get('/api/products/suggest?q=ted'))).toEqual(['Big Teddy']);
  });

  test('meta returns filter options', async () => {
    const res = await request(app).get('/api/products/meta');
    expect(res.body.categories).toEqual(['Accessories', 'Cards', 'Toys']);
    expect(res.body.priceRange).toEqual({ min: 150, max: 1200 });
  });

  test('product page by slug with related products and rating breakdown', async () => {
    await createProduct({ name: 'Another Birthday Gift', category: 'Mugs', occasions: ['Birthday'] });
    const res = await request(app).get('/api/products/slug/fancy-wallet');
    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe('Fancy Wallet');
    expect(res.body.related.map((p) => p.name)).toContain('Another Birthday Gift');
    expect(res.body.related.map((p) => p.name)).not.toContain('Big Teddy'); // out of stock
    expect(res.body.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(res.body.canReview).toBe(false);
  });

  test('unknown slug -> 404', async () => {
    expect((await request(app).get('/api/products/slug/nothing-here')).status).toBe(404);
  });
});

describe('gift finder', () => {
  test('ranks full matches first, stays within budget and explains why', async () => {
    await createProduct({ name: 'Her Birthday Box', price: 800, occasions: ['Birthday'], recipients: ['For Her'] });
    await createProduct({ name: 'Him Birthday Box', price: 800, occasions: ['Birthday'], recipients: ['For Him'] });
    await createProduct({ name: 'Too Expensive', price: 5000, occasions: ['Birthday'], recipients: ['For Her'] });

    const res = await request(app).get('/api/products/gift-finder')
      .query({ recipient: 'For Her', occasion: 'Birthday', budgetMax: 1000 });
    expect(res.status).toBe(200);
    expect(res.body.products.map((p) => p.name)).toEqual(['Her Birthday Box', 'Him Birthday Box']);
    expect(res.body.products[0].matchReasons).toEqual(['For Her', 'Great for Birthday']);
    expect(res.body.perfectMatches).toBe(1);
    expect(res.body.relaxed).toBe(false);
  });

  test('says when it had to relax the match', async () => {
    await createProduct({ name: 'Kids Toy', occasions: ['Festival'], recipients: ['Kids'] });
    const res = await request(app).get('/api/products/gift-finder').query({ recipient: 'Parents', occasion: 'Wedding' });
    expect(res.body.relaxed).toBe(true);
    expect(res.body.products).toHaveLength(1);
  });
});
