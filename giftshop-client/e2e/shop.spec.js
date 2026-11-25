// Full journey through the real app: guest browsing, a new customer ordering, the demo customer reviewing,
// and the admin running the shop. Expects a freshly seeded database (npm run seed in giftshop-server).
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString().slice(-6);
const shopper = { name: 'E2E Shopper', email: `e2e${stamp}@test.com`, password: 'secret123' };
const productName = `E2E Lavender Candle ${stamp}`;
const couponCode = `E2E${stamp}`;
let shopperState; // saved login (refresh cookie) so we don't log in again and hit the rate limit
let adminState;
let onlineOrderNumber;

const isoInDays = (days, yearsAgo = 0) => {
  const d = new Date(Date.now() + days * 86400000);
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d.toISOString().slice(0, 10);
};

async function submitLogin(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

// Logs in and waits until the app has left the login page (navigating earlier would cancel the request)
async function login(page, email, password) {
  await submitLogin(page, email, password);
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

const toast = (page, text) => expect(page.getByText(text).first()).toBeVisible();

test('guest: home sentence leads to Gift Finder results with reasons', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Gifts that feel like they were chosen/ })).toBeVisible();
  await page.locator('#hero-who').selectOption('For Her');
  await page.locator('#hero-occasion').selectOption('Birthday');
  await page.locator('#hero-budget').selectOption('2000');
  await page.getByRole('button', { name: 'Show me gifts' }).click();
  await expect(page).toHaveURL(/gift-finder\?recipient=For\+Her|gift-finder\?recipient=For%20Her/);
  await expect(page.getByRole('heading', { name: "Gifts we think they'll love" })).toBeVisible();
  await expect(page.locator('article').first()).toBeVisible();
  await expect(page.getByText('Great for Birthday').first()).toBeVisible();
});

test('guest: step-by-step Gift Finder', async ({ page }) => {
  await page.goto('/gift-finder');
  await page.getByRole('button', { name: 'Couples' }).click();
  await page.getByRole('button', { name: 'Anniversary', exact: true }).click();
  await page.getByRole('button', { name: '₹1,000 to ₹2,000' }).click();
  await page.getByRole('button', { name: 'Skip and show gifts' }).click();
  await expect(page.locator('article').first()).toBeVisible();
});

test('guest: search suggestions, filters and product page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Search gifts' }).fill('mug');
  await page.getByRole('option', { name: /Personalised Photo Mug/ }).click();
  await expect(page.getByRole('heading', { name: 'Personalised Photo Mug' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();

  await page.goto('/shop?occasion=Wedding');
  await expect(page.getByRole('heading', { name: 'Wedding gifts' })).toBeVisible();
  // Filters live in the URL, which React Router updates as a transition, so wait for the URL, not the click
  await page.getByLabel('Only show gifts in stock').click();
  await expect(page).toHaveURL(/inStock=true/);
  await expect(page.getByLabel('Only show gifts in stock')).toBeChecked();
  await page.getByLabel('Sort by').selectOption('priceAsc');
  const prices = await page.locator('article .gift-tag').allInnerTexts();
  const nums = prices.map((p) => Number(p.replace(/[^\d.]/g, '')));
  expect(nums).toEqual([...nums].sort((a, b) => a - b));
});

test('guest: protected pages send you to log in, admin pages are blocked', async ({ page, request }) => {
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get('/api/admin/stats')).status()).toBe(401);
  expect((await request.get('/api/cart')).status()).toBe(401);
});

test('new customer: register, cart with option and coupon, checkout with gift options (COD)', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Your name').fill(shopper.name);
  await page.getByLabel('Email').fill(shopper.email);
  await page.getByLabel('Password').fill(shopper.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await toast(page, 'Your account is ready');

  await page.goto('/product/handmade-chocolate-box');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await toast(page, 'Choose an option first');
  await page.getByText('24 pieces (+₹350)').click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await toast(page, 'Added to cart');
  await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();

  await page.goto('/cart');
  await page.getByLabel('Coupon code').fill('OLD5');
  await page.getByLabel('Coupon code').press('Enter');
  await toast(page, 'This coupon has expired');
  await page.getByLabel('Coupon code').fill('welcome10');
  await page.getByLabel('Coupon code').press('Enter');
  await expect(page.getByText('WELCOME10 applied')).toBeVisible();
  await page.getByRole('button', { name: 'Check out' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await page.getByLabel('Full name').fill('Asha Rao');
  await page.getByLabel('Mobile number').fill('12345');
  await page.getByRole('button', { name: 'Save and use this address' }).click();
  await expect(page.getByText('Enter a 10-digit mobile number')).toBeVisible();
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByLabel('House number and street').fill('7, Lake View Road');
  await page.getByLabel('City').fill('Mysuru');
  await page.getByLabel('State').fill('Karnataka');
  await page.getByLabel('Pincode').fill('570001');
  await page.getByRole('button', { name: 'Save and use this address' }).click();
  await toast(page, 'Address saved');

  await page.getByRole('checkbox', { name: /Gift wrap it/ }).check();
  await page.getByLabel('Gift message (optional)').fill('Happy birthday, Amma!');
  await page.getByLabel('Deliver on (optional)').fill(isoInDays(5));
  // 899 + 350 = 1249, minus 10% = 1124.10 (free shipping), plus 49 gift wrap = 1173.10
  await expect(page.getByRole('button', { name: /Place order, ₹1,173.1/ })).toBeVisible();
  await page.getByRole('button', { name: /Place order/ }).click();

  await expect(page.getByRole('heading', { name: "Thank you, it's on its way" })).toBeVisible();
  await expect(page.getByText('₹1,173.1')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 0 items' })).toBeVisible();

  await page.getByRole('link', { name: 'Track this order' }).click();
  await expect(page.getByText('Happy birthday, Amma!')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('dialog').getByLabel('Reason (optional)').fill('Ordered the wrong size');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
  await toast(page, 'Order cancelled');
  await expect(page.getByText('Cancelled: Ordered the wrong size')).toBeVisible();

  shopperState = await page.context().storageState();
});

test('new customer: online payment, wishlist and birthday reminder', async ({ browser }) => {
  const context = await browser.newContext({ storageState: shopperState });
  const page = await context.newPage();

  await page.goto('/product/scented-candle-trio');
  await page.getByRole('button', { name: 'Save to wishlist' }).click();
  await toast(page, 'Saved to wishlist');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await toast(page, 'Added to cart');

  await page.goto('/checkout');
  await page.getByText('Pay online').click();
  await page.getByRole('button', { name: /Place order and pay/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Complete your payment' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^Pay ₹/ }).click();
  await expect(page.getByRole('heading', { name: "Thank you, it's on its way" })).toBeVisible();
  await expect(page.getByRole('main').getByText(/Payment received/)).toBeVisible();
  onlineOrderNumber = (await page.locator('b').filter({ hasText: /^GS-/ }).innerText()).trim();

  await page.goto('/account/wishlist');
  await expect(page.getByRole('link', { name: 'Scented Candle Trio', exact: true })).toBeVisible();

  await page.goto('/account/occasions');
  await page.getByRole('button', { name: 'Add your first reminder' }).click();
  await page.getByLabel('What is it?').fill("Sister's birthday");
  await page.getByLabel('Date', { exact: true }).fill(isoInDays(5, 20));
  await page.getByLabel('Whose is it? (optional)').fill('Meera');
  await page.getByRole('button', { name: 'Save reminder' }).click();
  await toast(page, 'Reminder saved');
  await page.goto('/');
  await expect(page.getByText("Sister's birthday")).toBeVisible();
  await expect(page.getByText(/is in 5 days/)).toBeVisible();

  shopperState = await context.storageState();
  await context.close();
});

test('demo customer: reviews a delivered gift', async ({ page }) => {
  await login(page, 'user@giftshop.com', 'user123');
  await page.goto('/account/orders');
  await page.getByRole('link').filter({ hasText: 'Delivered' }).first().click();
  await page.getByRole('link', { name: 'Write a review' }).first().click();
  await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();

  const edit = page.getByRole('button', { name: 'Edit' });
  if (await edit.isVisible()) await edit.click(); // already reviewed on an earlier run
  await page.getByRole('radio', { name: '5 stars' }).click();
  await page.getByPlaceholder('What did they think of it?').fill('Beautifully wrapped and arrived early. Loved it!');
  await page.getByRole('button', { name: /Post review|Save review/ }).click();
  await expect(page.getByText(/Thanks for your review|Review updated/).first()).toBeVisible();
  await expect(page.getByText('You rated this 5 out of 5.')).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/$/); // customers can't open the admin area
});

test('admin: dashboard, ships the paid order, creates a product and a coupon', async ({ page }) => {
  await login(page, 'admin@giftshop.com', 'admin123');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Revenue per day')).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();

  await page.goto('/admin/orders');
  await page.getByPlaceholder('Order number, name or email').fill(onlineOrderNumber);
  await page.getByRole('button', { name: onlineOrderNumber }).click();
  const dialog = page.getByRole('dialog');
  for (const step of ['Packed', 'Shipped', 'Delivered']) {
    await dialog.getByRole('button', { name: `Mark ${step}` }).click();
    await toast(page, `Order marked ${step}`);
  }
  await expect(dialog.getByText('This order is delivered. No further changes.')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/admin/products/new');
  await page.getByLabel('Name', { exact: true }).fill(productName);
  await page.getByLabel('Description').fill('A hand-poured lavender soy candle made for testing.');
  await page.getByLabel('Price (₹)').fill('499');
  await page.getByLabel('Sale price (₹, optional)').fill('599');
  await page.getByLabel('Category').fill('Home Decor');
  await page.getByLabel('Stock', { exact: true }).fill('7');
  await page.locator('label').filter({ hasText: /^Birthday$/ }).click();
  await page.locator('label').filter({ hasText: /^For Her$/ }).click();
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Must be lower than the price')).toBeVisible();
  await page.getByLabel('Sale price (₹, optional)').fill('449');
  await page.getByRole('button', { name: 'Create product' }).click();
  await toast(page, 'Product created');

  await page.goto(`/shop?search=${encodeURIComponent(productName)}`);
  await expect(page.getByRole('link', { name: productName, exact: true })).toBeVisible();

  await page.goto('/admin/coupons');
  await page.getByRole('button', { name: 'New coupon' }).click();
  await page.getByLabel('Code', { exact: true }).fill(couponCode);
  await page.getByLabel('Percent off').fill('15');
  await page.getByLabel('Valid until').fill(isoInDays(10));
  await page.getByRole('button', { name: 'Save coupon' }).click();
  await toast(page, 'Coupon saved');
  await expect(page.getByRole('cell', { name: new RegExp(couponCode) })).toBeVisible();

  adminState = await page.context().storageState();
});

test('mobile layout: menu, sticky cart bar and checkout button', async ({ browser }) => {
  const context = await browser.newContext({ storageState: shopperState, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/product/personalised-photo-mug');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: /1 item in your cart/ })).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Gift Finder' })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('button', { name: 'Check out' })).toBeVisible();
  await context.close();
});

test('admin: blocking a customer stops them from logging in', async ({ browser }) => {
  const adminCtx = await browser.newContext({ storageState: adminState });
  const admin = await adminCtx.newPage();
  await admin.goto('/admin/users');
  await admin.getByLabel('Search customers').fill(shopper.email);
  const row = admin.getByRole('row').filter({ hasText: shopper.email });
  await expect(admin.getByRole('row')).toHaveCount(2); // header + the one matching customer
  await row.getByRole('button', { name: 'Block' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Block customer' }).click();
  await expect(admin.getByText(/is blocked and logged out/)).toBeVisible();

  const blocked = await browser.newPage();
  await submitLogin(blocked, shopper.email, shopper.password);
  await expect(blocked.getByText('Your account has been blocked. Please contact support.')).toBeVisible();
  await blocked.close();

  await row.getByRole('button', { name: 'Unblock' }).click();
  await expect(admin.getByText(/can log in again/)).toBeVisible();
  await adminCtx.close();
});
