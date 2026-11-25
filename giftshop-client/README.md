# Giftsy frontend

React 18 + Vite + Tailwind CSS. Talks to the `giftshop-server` API.

> For the whole project (setup scripts, demo accounts, features, configuration, troubleshooting) see the **main README** one folder up.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (expects the API on http://localhost:5000)
npm test             # 19 unit tests (Vitest)
npm run e2e          # end-to-end tests (Playwright), see below
npm run build        # production build in dist/
```

## Pages

| Path | Page |
|---|---|
| `/` | Home: gift sentence, occasion bands, upcoming reminders, favourites, shop by budget and recipient, trending |
| `/shop` | Search, filters (occasion, recipient, category, price, rating, in stock), sort, pagination. Filters live in the URL |
| `/gift-finder` | Four-question quiz with explained matches |
| `/product/:slug` | Gallery, options, stock, add to cart, wishlist, reviews with breakdown, related gifts |
| `/cart` | Quantities, save for later, coupons, free-shipping progress, delivery estimate |
| `/checkout` | Saved or new address, ship to someone else, gift wrap and message, delivery date, COD or online payment |
| `/order-success/:id` | Confirmation |
| `/account` | Profile, password, log out everywhere, orders with status timeline, cancel, invoice PDF, pay now, wishlist, addresses, reminders |
| `/admin` | Dashboard charts, orders, products (with image upload and bulk stock), coupons, customers (block), reviews |

## How it's built

- **Auth:** the access token is kept in memory only. The refresh token is an httpOnly cookie, so page scripts can't read either from storage. A 401 triggers one shared refresh and the request is retried (`src/api/client.js`).
- **Data:** `useApi` hook for loading and error states. `AuthContext` holds the user and wishlist, and `CartContext` the cart with optimistic updates.
- **Code splitting:** every page except Home is lazy-loaded. The chart library only loads on the admin dashboard.
- **Design:** colours from the palette Plum Velvet `#5E3A4D`, Rosewood `#C77486`, Vanilla Cream `#F4E1D2`, Sage Leaf `#A8B89A` and Lavender Sky `#A7B0D6`, as CSS variables with light and dark sets (`src/index.css`). A separate red (`#B3261E`, `danger` in Tailwind) is reserved for errors and destructive actions, so errors never look like sale badges. Text colours meet WCAG AA contrast. Fonts are Fraunces and Figtree, self-hosted.
- **Recipient themes:** `RECIPIENT_STYLE` in `src/utils/constants.js` gives each recipient a colour pairing (Plum and Sage for "For Him", Rosewood for "For Her", and so on), used by `CollectionHeader` on the shop page and by Gift Finder results.
- **Accessibility:** keyboard focus rings, skip link, labelled forms and dialogs, reduced-motion support.

## End-to-end tests

1. In `giftshop-server`: start MongoDB, run `npm run seed`, then `npm run dev`. Set `AUTH_RATE_LIMIT=100` in its `.env` for test runs.
2. Here: `npm run dev`
3. In a third terminal: `npm run e2e`. On Windows this uses Microsoft Edge, which is already installed. Elsewhere, run `npx playwright install chromium` once.

The 10 tests cover browsing, Gift Finder, search, filters, registration, cart with options and coupons, checkout with gift options, cancelling, online payment, wishlist, reminders, reviews, the admin order flow, products, coupons, blocking customers, access control and the mobile layout.

## Deploying

- Vercel: import the folder, framework "Vite", set `VITE_API_URL` to the API's URL. `vercel.json` adds SPA routing and security headers (CSP, HSTS, nosniff). If your API is not on `*.onrender.com`, add its domain to `connect-src` in `vercel.json`.
- Netlify: `public/_redirects` handles SPA routing.
- On the API, set `CLIENT_URL` to the frontend's URL so CORS and the refresh cookie work.
