import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors, imageUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import AddressForm, { validateAddress } from '../components/AddressForm';
import PaymentModal from '../components/PaymentModal';
import { PageLoader, Spinner } from '../components/ui';
import { isoDay, money } from '../utils/format';
import { Totals } from './Cart';

const GIFT_WRAP_FEE = 49;
const EMPTY_ADDRESS = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

function Section({ step, title, children }) {
  return (
    <section className="card p-6" aria-labelledby={`step-${step}`}>
      <h2 id={`step-${step}`} className="mb-5 flex items-center gap-3 text-2xl">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand font-sans text-sm font-bold text-brand-ink">{step}</span>{title}
      </h2>
      {children}
    </section>
  );
}

export default function Checkout() {
  useTitle('Checkout');
  const { user, setUser } = useAuth();
  const { cart, loaded, refresh } = useCart();
  const navigate = useNavigate();
  const paymentConfig = useApi('/payments/config');

  const addresses = user?.addresses || [];
  const [addressId, setAddressId] = useState(() => (addresses.find((a) => a.isDefault) || addresses[0])?._id || '');
  const [addingAddress, setAddingAddress] = useState(addresses.length === 0);
  const [someoneElse, setSomeoneElse] = useState(false);
  const [recipient, setRecipient] = useState(EMPTY_ADDRESS);
  const [recipientErrors, setRecipientErrors] = useState({});
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [placing, setPlacing] = useState(false);
  const [pending, setPending] = useState(null); // { order, payment } waiting for online payment
  const [placedId, setPlacedId] = useState(null); // set once an order exists, so the emptied cart doesn't bounce us to /cart

  if (!loaded) return <PageLoader />;
  if (placedId && !pending) return <Navigate to={`/order-success/${placedId}`} replace />;
  if (!cart.items.length && !pending) return <Navigate to="/cart" replace />;

  const minDate = cart.delivery ? isoDay(cart.delivery.earliest) : '';
  const maxDate = cart.delivery ? isoDay(new Date(new Date(cart.delivery.earliest).getTime() + 27 * 86400000)) : '';
  const blocked = cart.items.some((i) => !i.inStock);

  const saveAddress = async (body) => {
    try {
      const { data } = await api.post('/account/addresses', body);
      setUser((u) => ({ ...u, addresses: data.addresses }));
      setAddressId(data.addresses[data.addresses.length - 1]._id);
      setAddingAddress(false);
      toast.success('Address saved');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const placeOrder = async () => {
    const body = { giftWrap, giftMessage: giftMessage.trim(), paymentMethod, shipToSomeoneElse: someoneElse };
    if (someoneElse) {
      const errs = validateAddress(recipient);
      setRecipientErrors(errs);
      if (Object.keys(errs).length) { toast.error("Check the recipient's address"); return; }
      body.shippingAddress = { ...recipient, line2: recipient.line2 || '' };
    } else {
      if (!addressId) { toast.error('Choose or add a delivery address'); return; }
      body.addressId = addressId;
    }
    if (deliveryDate) body.deliveryDate = deliveryDate;

    setPlacing(true);
    try {
      const { data } = await api.post('/orders', body);
      // Record the order BEFORE refreshing the (now empty) cart. React Router runs navigation as a
      // low-priority transition, so without this the empty cart would redirect to /cart first.
      setPlacedId(data.order._id);
      if (data.payment) setPending(data);
      refresh();
    } catch (err) {
      setRecipientErrors(fieldErrors(err));
      toast.error(errorMessage(err));
      refresh();
    } finally {
      setPlacing(false);
    }
  };

  const total = cart.total + (giftWrap ? GIFT_WRAP_FEE : 0);

  return (
    <div className="page pt-8">
      <h1 className="text-4xl sm:text-5xl">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section step={1} title="Where should it go?">
            <label className="mb-5 flex items-center gap-2.5 text-sm font-medium">
              <input type="checkbox" checked={someoneElse} onChange={(e) => setSomeoneElse(e.target.checked)} className="h-4 w-4 accent-[#9B4A5F]" />
              Send it straight to the person it's for
            </label>
            {someoneElse ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[['fullName', "Recipient's name"], ['phone', "Recipient's mobile"], ['line1', 'House number and street', true], ['line2', 'Area or landmark (optional)', true], ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode']].map(([k, label, wide]) => (
                  <div key={k} className={wide ? 'sm:col-span-2' : ''}>
                    <label className="label" htmlFor={`r-${k}`}>{label}</label>
                    <input id={`r-${k}`} className="input" value={recipient[k]} onChange={(e) => setRecipient({ ...recipient, [k]: e.target.value })} aria-invalid={Boolean(recipientErrors[k])}
                      inputMode={['phone', 'pincode'].includes(k) ? 'numeric' : undefined} maxLength={k === 'phone' ? 10 : k === 'pincode' ? 6 : 200} />
                    {recipientErrors[k] && <p className="field-error" role="alert">{recipientErrors[k]}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <>
                {addresses.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
                    {addresses.map((a) => (
                      <label key={a._id} className={`cursor-pointer rounded-xl border p-4 text-sm ${addressId === a._id ? 'border-accent bg-rose/10 ring-1 ring-accent' : 'border-line'}`}>
                        <input type="radio" name="address" className="sr-only" checked={addressId === a._id} onChange={() => setAddressId(a._id)} />
                        <span className="font-semibold">{a.label || 'Address'}</span>{a.isDefault && <span className="chip-sage ml-2">Default</span>}
                        <span className="mt-1 block text-muted">{a.fullName}, {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}</span>
                      </label>
                    ))}
                  </div>
                )}
                {addingAddress ? (
                  <div className={addresses.length ? 'mt-6 border-t border-line pt-6' : ''}>
                    <AddressForm onSubmit={saveAddress} onCancel={addresses.length ? () => setAddingAddress(false) : undefined} submitLabel="Save and use this address" />
                  </div>
                ) : (
                  <button type="button" className="btn-outline btn-sm mt-4" onClick={() => setAddingAddress(true)}>Add a new address</button>
                )}
              </>
            )}
          </Section>

          <Section step={2} title="Make it a gift">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#9B4A5F]" />
              <span><b>Gift wrap it</b> for {money(GIFT_WRAP_FEE)}. Wrapped in paper and ribbon, with prices removed.</span>
            </label>
            <div className="mt-5">
              <label htmlFor="msg" className="label">Gift message (optional)</label>
              <textarea id="msg" className="input min-h-24" maxLength={250} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Happy birthday! Can't wait to celebrate with you." />
              <p className="mt-1 text-right text-xs text-muted">{giftMessage.length}/250</p>
            </div>
            <div className="mt-2 max-w-xs">
              <label htmlFor="date" className="label">Deliver on (optional)</label>
              <input id="date" type="date" className="input" min={minDate} max={maxDate} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Leave empty for the earliest delivery.</p>
            </div>
          </Section>

          <Section step={3} title="How would you like to pay?">
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
              {[['COD', 'Cash on delivery', 'Pay when the gift arrives.'],
                ['ONLINE', 'Pay online', paymentConfig.data?.provider === 'razorpay' ? 'Card, UPI or net banking through Razorpay.' : 'Demo payment, no money is taken.']].map(([v, title, sub]) => (
                <label key={v} className={`cursor-pointer rounded-xl border p-4 ${paymentMethod === v ? 'border-accent bg-rose/10 ring-1 ring-accent' : 'border-line'}`}>
                  <input type="radio" name="pay" className="sr-only" checked={paymentMethod === v} onChange={() => setPaymentMethod(v)} />
                  <span className="block font-semibold">{title}</span><span className="text-sm text-muted">{sub}</span>
                </label>
              ))}
            </div>
          </Section>
        </div>

        <aside className="card h-fit space-y-5 p-6 lg:sticky lg:top-24">
          <h2 className="text-2xl">Your order</h2>
          <ul className="space-y-3">
            {cart.items.map((i) => (
              <li key={i._id} className="flex items-center gap-3 text-sm">
                <img src={imageUrl(i.product.image)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <span className="flex-1">{i.product.name}{i.variant ? ` (${i.variant})` : ''} <span className="text-muted">× {i.qty}</span></span>
                <span>{money(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <Totals cart={cart} giftWrapFee={giftWrap ? GIFT_WRAP_FEE : 0} />
          <button type="button" className="btn-primary w-full py-3" onClick={placeOrder} disabled={placing || blocked}>
            {placing && <Spinner className="h-4 w-4" />}{paymentMethod === 'ONLINE' ? `Place order and pay ${money(total)}` : `Place order, ${money(total)}`}
          </button>
          {blocked && <p className="text-center text-xs font-medium text-danger" role="alert">Some items are out of stock. <Link to="/cart" className="link">Update your cart</Link></p>}
          <p className="text-center text-xs text-muted">Prices are checked again when you place the order.</p>
        </aside>
      </div>

      {pending && (
        <PaymentModal
          payment={pending.payment}
          onPaid={(order) => navigate(`/order-success/${order._id}`, { replace: true })}
          onClose={() => {
            toast('Your order is saved. Pay from your orders within 30 minutes.', { icon: '⏳' });
            navigate(`/account/orders/${pending.order._id}`, { replace: true });
          }}
        />
      )}
    </div>
  );
}
