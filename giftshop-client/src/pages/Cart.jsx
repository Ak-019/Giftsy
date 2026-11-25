import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Tag, Trash2, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import { imageUrl } from '../api/client';
import { EmptyState, PageLoader, QtyStepper, Spinner } from '../components/ui';
import { date, money, plural } from '../utils/format';

function CartLine({ item }) {
  const { updateQty, remove, saveForLater } = useCart();
  const p = item.product;
  return (
    <li className="flex gap-4 py-5">
      <Link to={`/product/${p.slug}`} className="shrink-0"><img src={imageUrl(p.image)} alt="" className="h-24 w-24 rounded-xl object-cover sm:h-28 sm:w-28" /></Link>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex justify-between gap-3">
          <div>
            <Link to={`/product/${p.slug}`} className="font-medium hover:text-accent">{p.name}</Link>
            {item.variant && <p className="text-sm text-muted">{item.variant}</p>}
            <p className="text-sm text-muted">{money(item.unitPrice)} each</p>
          </div>
          <p className="font-display text-lg font-semibold">{money(item.lineTotal)}</p>
        </div>
        {!item.inStock && <p className="text-error" role="alert">{p.stock === 0 ? 'Out of stock. Remove it to check out.' : `Only ${p.stock} left. Lower the quantity to check out.`}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <QtyStepper value={item.qty} onChange={(q) => updateQty(item._id, q)} max={Math.max(1, Math.min(10, p.stock))} />
          <button type="button" className="btn-ghost btn-sm" onClick={() => saveForLater(item._id)}>Save for later</button>
          <button type="button" className="btn-ghost btn-sm text-muted hover:text-danger" onClick={() => remove(item._id)} aria-label={`Remove ${p.name}`}><Trash2 className="h-4 w-4" />Remove</button>
        </div>
      </div>
    </li>
  );
}

function CouponBox() {
  const { cart, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const available = useApi('/coupons');

  const apply = async (c) => {
    setBusy(true);
    if (await applyCoupon(c)) setCode('');
    setBusy(false);
  };

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-sage/30 px-4 py-3 text-sm">
        <span><Tag className="mr-1.5 inline h-4 w-4" /><b>{cart.coupon.code}</b> applied</span>
        <button type="button" className="link" onClick={removeCoupon}>Remove</button>
      </div>
    );
  }
  return (
    <div>
      {cart.couponError && <p className="text-error mb-2" role="alert">{cart.couponError}</p>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) apply(code.trim()); }}>
        <label htmlFor="coupon" className="sr-only">Coupon code</label>
        <input id="coupon" className="input py-2 uppercase" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
        <button type="submit" className="btn-outline btn-sm shrink-0" disabled={busy || !code.trim()}>{busy && <Spinner className="h-3 w-3" />}Apply</button>
      </form>
      {available.data?.coupons.length > 0 && (
        <ul className="mt-3 space-y-2">
          {available.data.coupons.map((c) => (
            <li key={c.code} className="flex items-center justify-between gap-2 text-sm">
              <span><b className="font-semibold">{c.code}</b> <span className="text-muted">{c.description}</span></span>
              <button type="button" className="link shrink-0" onClick={() => apply(c.code)} disabled={busy}>Apply</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Totals({ cart, giftWrapFee = 0 }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
      {cart.discount > 0 && <div className="flex justify-between text-sage-ink"><dt>Discount{cart.coupon ? ` (${cart.coupon.code})` : ''}</dt><dd>−{money(cart.discount)}</dd></div>}
      {giftWrapFee > 0 && <div className="flex justify-between"><dt>Gift wrap</dt><dd>{money(giftWrapFee)}</dd></div>}
      <div className="flex justify-between"><dt>Shipping</dt><dd>{cart.shippingFee ? money(cart.shippingFee) : 'Free'}</dd></div>
      <div className="flex justify-between border-t border-line pt-3 font-display text-xl"><dt>Total</dt><dd>{money(cart.total + giftWrapFee)}</dd></div>
    </dl>
  );
}

export default function Cart() {
  useTitle('Your cart');
  const { user, ready } = useAuth();
  const { cart, loaded, moveToCart, removeSaved } = useCart();
  const navigate = useNavigate();

  if (!ready || (user && !loaded)) return <PageLoader />;
  if (!user) {
    return (
      <EmptyState icon={ShoppingBag} title="Log in to see your cart" action={<Link to="/login?next=/cart" className="btn-primary">Log in</Link>}>
        Your cart is saved to your account, so it's there on any device.
      </EmptyState>
    );
  }

  const blocked = cart.items.some((i) => !i.inStock);
  const progress = cart.freeShippingAbove ? Math.min(100, ((cart.subtotal - cart.discount) / cart.freeShippingAbove) * 100) : 100;

  return (
    <div className="page pt-8">
      <h1 className="text-4xl sm:text-5xl">Your cart</h1>
      {cart.items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Link to="/shop" className="btn-primary">Browse gifts</Link>}>
          Not sure where to start? The Gift Finder picks gifts in four questions.
        </EmptyState>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <ul className="divide-y divide-line border-y border-line">{cart.items.map((i) => <CartLine key={i._id} item={i} />)}</ul>
          <aside className="card h-fit space-y-5 p-6 lg:sticky lg:top-24">
            <div>
              <p className="text-sm">{cart.amountForFreeShipping > 0 ? <>Add <b>{money(cart.amountForFreeShipping)}</b> more for free shipping</> : 'Your order ships free'}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-sage" style={{ width: `${progress}%` }} /></div>
            </div>
            <CouponBox />
            <Totals cart={cart} />
            {cart.delivery && (
              <p className="flex gap-2 text-sm text-muted"><Truck className="h-4 w-4 shrink-0" aria-hidden="true" />Arrives between {date(cart.delivery.earliest, { day: 'numeric', month: 'short' })} and {date(cart.delivery.latest, { day: 'numeric', month: 'short' })}</p>
            )}
            <button type="button" className="btn-primary w-full py-3" disabled={blocked} onClick={() => navigate('/checkout')}>Check out</button>
            {blocked && <p className="text-center text-xs font-medium text-danger">Fix the items marked in red to continue.</p>}
          </aside>
        </div>
      )}

      {cart.savedForLater.length > 0 && (
        <section className="mt-14">
          <h2 className="text-3xl">Saved for later ({cart.savedForLater.length})</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cart.savedForLater.map((s) => (
              <li key={s._id} className="card flex gap-4 p-4">
                <img src={imageUrl(s.product.image)} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <div className="flex flex-1 flex-col">
                  <Link to={`/product/${s.product.slug}`} className="font-medium hover:text-accent">{s.product.name}</Link>
                  <p className="text-sm text-muted">{s.variant ? `${s.variant}, ` : ''}{money(s.unitPrice)}</p>
                  <div className="mt-auto flex gap-3 pt-2 text-sm">
                    <button type="button" className="link" onClick={() => moveToCart(s._id)}>Move to cart</button>
                    <button type="button" className="text-muted hover:text-ink" onClick={() => removeSaved(s._id)}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {cart.items.length > 0 && <p className="mt-6 text-sm text-muted">{plural(cart.itemCount, 'item')} in your cart</p>}
    </div>
  );
}
