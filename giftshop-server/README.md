# Giftsy API

REST API for the Giftsy gift shop: Node.js, Express, MongoDB (Mongoose), Zod validation and JWT auth with refresh tokens.

> For the whole project (setup scripts, features, configuration, troubleshooting) see the **main README** one folder up. This file is the API reference and the backend's design notes.

## Quick start

```bash
npm install
# Windows: copy .env.example .env     macOS/Linux: cp .env.example .env
# then set JWT_SECRET and JWT_REFRESH_SECRET in .env (MONGO_URI defaults to a local MongoDB)
npm run seed        # 16 products, 5 users, 4 coupons, 40 orders over the last 30 days, 29 reviews
npm run dev         # http://localhost:5000/api/health
npm run test:unit   # 54 unit and smoke tests, no database needed
npm test            # all 118 tests, including API tests against a throwaway MongoDB
```

`npm test` starts a temporary in-memory MongoDB. It uses your installed `mongod` if `MONGOMS_SYSTEM_BINARY` points to it (the `1-install-and-test.cmd` script sets this), otherwise it downloads one (about 70 MB) on the first run.

**Demo logins:** `admin@giftshop.com / admin123` and `user@giftshop.com / user123`
**Demo coupons:** `WELCOME10`, `FLAT150` (min ₹999), `FESTIVE20` (min ₹1499). `OLD5` is expired, for testing.

Payments use a built-in **mock** provider by default. Add Razorpay test keys to `.env` to switch to real Razorpay test mode.
Emails are only logged unless SMTP settings are filled in.

## Features

| Area | What's included |
|---|---|
| Auth | Register, login, 15-minute access token + 7-day refresh token in an httpOnly cookie, refresh with rotation, logout, logout from all devices, blocked-user check |
| Account | Profile, change password, address book with a default address, wishlist, occasion reminders (birthdays, anniversaries) with "upcoming in N days" |
| Products | Search (text index), multi-filters (category, occasion, recipient, price, rating, in stock), sorting, pagination, slugs, discount price, variants (size or colour with a price difference), related products, rating breakdown, search suggestions, filter metadata |
| Gift Finder | Scores products by recipient, occasion, budget and interests, and says *why* each one matched |
| Reviews | Only buyers can review, one review each, edit and delete your own, average rating kept up to date |
| Cart | Live prices, variants, quantity and stock checks, save for later, coupons, free-shipping progress, delivery estimate |
| Checkout | Saved address or "ship to someone else", gift message, gift wrap, delivery date picker, COD or online payment |
| Orders | Status timeline, cancel while "Placed", PDF invoice, confirmation and status emails |
| Payments | Mock flow or Razorpay test mode: server-side signature check, webhook with signature check, unpaid orders auto-cancelled after 30 minutes |
| Admin | Dashboard stats (revenue, orders per day, status breakdown, top products, low stock, recent orders), order list with filters and search, status changes with allowed transitions, product CRUD, image upload, bulk stock update, coupon CRUD, user list with block/unblock, review moderation |
| Security | Helmet, CORS with credentials, rate limits (stricter on login/register), Zod validation on every route (unknown fields dropped), NoSQL-injection sanitising, central error handler |

## Project structure

```
app.js              Express app (middleware + routes), imported by server.js and the tests
server.js           connects to MongoDB, starts the server and background job
config/             db connection, business constants (fees, statuses, allowed transitions)
models/             User, Product, Cart, Order, Review, Coupon
validators/         Zod schemas for every route
middleware/         auth (protect, adminOnly, optionalAuth), validate, rate limits, uploads, errors
controllers/        one file per area
services/           order state changes (cancel, advance, mark paid) and the unpaid-order job
utils/              pricing, tokens, payments, email, invoice PDF, slugs, occasions, ratings
data/products.js    demo catalogue used by seed.js
tests/unit          no database needed
tests/api           full API tests against an in-memory MongoDB
```

Flow: **client → route → validate (Zod) → controller → service/model (Mongoose) → MongoDB**

## API reference

All responses are JSON with `success: true|false`. Send `Authorization: Bearer <accessToken>` for protected routes.
Errors look like `{ success: false, message, details? }`.

### Auth: `/api/auth`
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | /register | public | `{ name, email, password }` → `{ accessToken, user }` + refresh cookie |
| POST | /login | public | `{ email, password }` |
| POST | /refresh | cookie | new access token, rotates the cookie |
| POST | /logout | public | clears the cookie |
| POST | /logout-all | user | invalidates every refresh token |
| GET | /me | user | current user (addresses, wishlist ids, occasions) |

### Account: `/api/account` (logged in)
| Method | Path | Notes |
|---|---|---|
| PUT | /profile | `{ name?, phone? }` |
| PUT | /password | `{ currentPassword, newPassword }` → new tokens |
| GET, POST | /addresses | `{ label?, fullName, phone, line1, line2?, city, state, pincode, isDefault? }` |
| PUT, DELETE | /addresses/:id | |
| GET | /wishlist | with product details |
| POST, DELETE | /wishlist/:productId | POST toggles |
| GET, POST | /occasions | `{ title, type, personName?, date, recurring?, note? }` |
| GET | /occasions/upcoming?days=30 | sorted by `daysLeft`, includes `giftFinderQuery` |
| PUT, DELETE | /occasions/:id | |

### Products: `/api/products`
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | / | public | `search, category (comma list), occasion, recipient, minPrice, maxPrice, minRating, inStock, featured, sort (relevance, newest, priceAsc, priceDesc, rating, popular, stock), page, limit` |
| GET | /meta | public | categories, occasions, recipients, price range |
| GET | /suggest?q= | public | search-box dropdown |
| GET | /gift-finder | public | `recipient, occasion, budgetMin, budgetMax, interests, limit` |
| GET | /slug/:slug, /:id | public | product, reviews, ratingBreakdown, related, and for logged-in users `canReview, userReview, inWishlist` |
| GET | /:id/reviews | public | `sort (newest, highest, lowest), page` |
| POST | /:id/reviews | buyer | `{ rating, comment }` |
| POST | / | admin | create |
| PUT, DELETE | /:id | admin | update / delete |

### Reviews: `/api/reviews`
`PUT /:id` (own review), `DELETE /:id` (own review, or any review for admins)

### Cart: `/api/cart` (logged in)
| Method | Path | Notes |
|---|---|---|
| GET | / | items, savedForLater, subtotal, discount, shippingFee, total, delivery window |
| POST | / | `{ productId, qty, variant? }` |
| DELETE | / | clear |
| PUT, DELETE | /items/:itemId | `{ qty }` |
| POST | /items/:itemId/save-for-later | |
| POST | /saved/:itemId/move-to-cart | |
| DELETE | /saved/:itemId | |
| POST, DELETE | /coupon | `{ code }` |

`GET /api/coupons` lists active coupons (public).

### Orders: `/api/orders` (logged in)
| Method | Path | Notes |
|---|---|---|
| POST | / | `{ addressId \| shippingAddress, shipToSomeoneElse?, giftMessage?, giftWrap?, deliveryDate?, paymentMethod: COD\|ONLINE }` → `{ order, payment }` |
| GET | /my | paginated |
| GET | /:id | owner or admin |
| GET | /:id/invoice | PDF |
| PUT | /:id/cancel | `{ reason? }`, only while Placed |

### Payments: `/api/payments`
| Method | Path | Notes |
|---|---|---|
| GET | /config | `{ provider: 'mock' \| 'razorpay', keyId }` |
| POST | /mock-pay | `{ orderId }` (mock mode only) |
| POST | /verify | `{ orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` |
| POST | /webhook | Razorpay server-to-server, `x-razorpay-signature` header |

### Admin: `/api/admin` (admin only)
| Method | Path | Notes |
|---|---|---|
| GET | /stats?days=30 | totals, ordersPerDay, statusBreakdown, topProducts, lowStock, recentOrders |
| GET | /orders | `status, paymentStatus, search, from, to, page` |
| PUT | /orders/:id/status | `{ status, note? }` follows Placed → Packed → Shipped → Delivered; Cancelled allowed from Placed/Packed |
| PATCH | /products/stock | `{ items: [{ id, stock }] }` |
| GET | /users | `search, role, blocked, page` (includes order count and amount spent) |
| PUT | /users/:id/block | `{ isBlocked }` |
| GET | /reviews | `product, rating, page` |
| GET, POST | /coupons | |
| PUT, DELETE | /coupons/:id | |

`POST /api/uploads` (admin, multipart field `images`, up to 5 JPG/PNG/WEBP of 2 MB each) → image URLs.

## Design decisions (interview talking points)

- **Prices are calculated on the server only.** The order is built from the server-side cart and database prices. Zod drops any `total` or `price` the client sends.
- **Atomic stock deduction.** `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })`: the check and the decrement happen in one operation, so two buyers can't both get the last unit. If a later item fails, earlier deductions are rolled back. There's a test that fires two orders at once for one unit.
- **Coupon limits use the same pattern.** A use is claimed only while `usedCount < usageLimit` and the user isn't in `usedBy`, all in one update.
- **Order snapshots.** Items store name, variant and price at purchase time, so history stays correct after price changes.
- **Cancelling happens once.** Cancel is a conditional update (`status in [allowed]`), so a double click can't restore stock twice. Stock and the coupon use are returned. Paid orders move to "Refund Pending".
- **Allowed status transitions** are defined in `config/constants.js`. Online orders can't be packed until they are paid.
- **Payments are verified on the server** with an HMAC-SHA256 signature check (constant-time comparison). The webhook and the client confirmation are both safe to run, and only the first one marks the order paid.
- **Unpaid online orders expire** after 30 minutes and release their stock.
- **Auth:** the short-lived access token is kept in memory and the refresh token in an httpOnly cookie (JavaScript can't read it). A `tokenVersion` counter lets "log out everywhere", password change and blocking revoke every session.
- **Why no MongoDB transactions?** They need a replica set (Atlas has one, a plain local MongoDB doesn't). Atomic updates plus rollback work everywhere. On Atlas the order flow could be wrapped in `session.withTransaction()`.

## Security checklist

| Risk | What the app does |
|---|---|
| Price tampering | Totals are computed on the server from database prices. Zod drops client-sent `total`, `price` and `role` fields |
| Overselling, coupon abuse | Atomic conditional updates for stock and coupon uses, plus rollback |
| Stolen tokens | Short-lived access token kept in memory; refresh token in an httpOnly, Secure, SameSite cookie with rotation; `tokenVersion` revokes all sessions (logout everywhere, password change, block) |
| Forged tokens | JWT algorithm pinned to HS256 (an `alg: none` token is rejected); separate secrets for access and refresh tokens; the server refuses to start in production with weak secrets |
| CSRF | Cookie routes (`/auth/refresh`, `/auth/logout`) require an `X-Requested-With` header, which other sites can't send cross-origin; CORS only allows `CLIENT_URL` |
| Brute force | 10 login/register attempts per 15 minutes per IP; bcrypt hashing; same response time for unknown emails |
| NoSQL injection | `express-mongo-sanitize`, Zod type checks, `strictQuery`, regex input escaped |
| XSS | React escapes output; emails escape user text; the frontend CSP blocks inline and third-party scripts (except Razorpay) |
| File uploads | Admin only, JPG/PNG/WEBP checked by their first bytes (not just the reported type), 2 MB limit, random file names, served with `nosniff` |
| Payments | Razorpay signature checked on the server with a constant-time comparison; webhook signature checked against the raw body; marking an order paid is idempotent |
| Information leaks | Helmet headers, no `x-powered-by`, generic 500 messages in production, password and token fields never returned |
| Open redirects | Login `next=` only accepts paths on this site |
| Dependencies | `npm audit` reports 0 known vulnerabilities in both projects |

## Scaling notes

- **Stateless API:** JWTs and no server sessions, so you can run several instances behind a load balancer. Two things are per-instance today: the in-memory rate-limit counters (switch to `rate-limit-redis` when running more than one) and uploaded images on local disk (switch to Cloudinary or S3).
- **Database:** indexes on text search, category + price, occasions, recipients, order status and date, and a unique review per user and product. Lists are paginated with a maximum page size. Product lists use `.lean()`. The connection pool size is configurable (`MONGO_POOL_SIZE`).
- **Responses:** gzip compression. On the frontend, routes are code-split and hashed assets are cached for a year.
- **Background work:** the unpaid-order cleanup is idempotent, so it's safe if several instances run it. At larger scale, move it to a single scheduled job.
- **Next steps at scale:** Redis caching for product lists and `/products/meta`, a CDN for images, and MongoDB transactions on Atlas (replica set) for the order flow.

## Deployment

- Database: MongoDB Atlas (free M0). Put the connection string in `MONGO_URI`.
- API: Render web service, build `npm install`, start `npm start`. Set `NODE_ENV=production`, the secrets, `CLIENT_URL=https://your-frontend.vercel.app` and `SERVER_URL=https://your-api.onrender.com`.
- In production the refresh cookie is `Secure; SameSite=None`, so the Vercel frontend and the Render API can be on different domains. The frontend must call the API with `credentials: 'include'` (axios: `withCredentials: true`).
- Uploaded images are stored on local disk, which Render wipes on redeploy. For a permanent setup, use Cloudinary.

## Possible next steps

Redis caching for product lists, Cloudinary for images, per-variant stock, refunds through the Razorpay API, and Swagger/OpenAPI docs.
