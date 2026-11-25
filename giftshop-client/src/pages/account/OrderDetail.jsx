import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage, imageUrl } from '../../api/client';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import StatusTimeline from '../../components/StatusTimeline';
import PaymentModal from '../../components/PaymentModal';
import { ConfirmDialog, ErrorState, PageLoader, Spinner } from '../../components/ui';
import { STATUS_CHIP } from '../../utils/constants';
import { date, money } from '../../utils/format';
import { paymentForOrder } from '../../utils/payment';

// Downloads the PDF with the auth header (a plain link couldn't send it)
export async function downloadInvoice(order) {
  try {
    const res = await api.get(`/orders/${order._id}/invoice`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${order.orderNumber}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    toast.error(errorMessage(err));
  }
}

export default function OrderDetail() {
  const { id } = useParams();
  const { data, setData, loading, error, reload } = useApi(`/orders/${id}`);
  const payConfig = useApi('/payments/config');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [payment, setPayment] = useState(null);
  useTitle(data ? `Order ${data.order.orderNumber}` : 'Order');

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { order } = data;
  const a = order.shippingAddress;
  const awaitingPayment = order.paymentMethod === 'ONLINE' && order.paymentStatus === 'Pending' && order.status !== 'Cancelled';

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await api.put(`/orders/${order._id}/cancel`, reason.trim() ? { reason: reason.trim() } : {});
      setData({ order: { ...order, ...res.data.order } });
      setCancelOpen(false);
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Link to="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" />All orders</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl">Order {order.orderNumber}</h2>
          <p className="text-sm text-muted">Placed on {date(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {awaitingPayment && <button type="button" className="btn-accent btn-sm" onClick={() => setPayment(paymentForOrder(order, payConfig.data || { provider: 'mock' }))}>Pay now</button>}
          <button type="button" className="btn-outline btn-sm" disabled={downloading} onClick={async () => { setDownloading(true); await downloadInvoice(order); setDownloading(false); }}>
            {downloading ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}Invoice
          </button>
          {order.status === 'Placed' && <button type="button" className="btn-danger btn-sm" onClick={() => setCancelOpen(true)}>Cancel order</button>}
        </div>
      </div>

      {awaitingPayment && <p className="rounded-xl bg-rose/20 px-4 py-3 text-sm">This order is waiting for payment. Unpaid online orders are cancelled after 30 minutes.</p>}

      <div className="card p-6"><StatusTimeline order={order} /></div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-3 text-xl">Delivery</h3>
          <p className="text-sm">{a.fullName}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</p>
          <p className="mt-3 text-sm text-muted">{order.deliveryDate ? `Requested for ${date(order.deliveryDate)}` : 'Standard delivery, 3 to 7 days'}</p>
          {order.status === 'Cancelled' && order.cancelReason && <p className="mt-3 text-sm text-muted">Cancelled: {order.cancelReason}</p>}
        </div>
        <div className="card p-6">
          <h3 className="mb-3 text-xl">Gift details</h3>
          <p className="text-sm">{order.giftWrap ? 'Gift wrapped' : 'No gift wrap'}</p>
          {order.giftMessage ? <blockquote className="mt-3 border-l-2 border-rose pl-3 font-display text-lg italic">“{order.giftMessage}”</blockquote> : <p className="mt-2 text-sm text-muted">No message</p>}
          <p className="mt-4 text-sm">Payment: {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Online'} <span className={`${STATUS_CHIP[order.paymentStatus]} ml-1`}>{order.paymentStatus}</span></p>
        </div>
      </div>

      <div className="card p-6">
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={`${i.product}-${i.variant}`} className="flex items-center gap-4 py-3">
              <img src={imageUrl(i.image)} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{i.name}{i.variant ? ` (${i.variant})` : ''}</p>
                <p className="text-muted">{money(i.price)} × {i.qty}</p>
                {order.status === 'Delivered' && i.product && <p className="mt-1 text-xs"><Link to={`/product/${encodeURIComponent(i.product)}`} className="link" state={{ review: true }}>Write a review</Link></p>}
              </div>
              <p className="font-medium">{money(i.price * i.qty)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between text-sage-ink"><dt>Discount ({order.couponCode})</dt><dd>−{money(order.discount)}</dd></div>}
          {order.giftWrapFee > 0 && <div className="flex justify-between"><dt>Gift wrap</dt><dd>{money(order.giftWrapFee)}</dd></div>}
          <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shippingFee ? money(order.shippingFee) : 'Free'}</dd></div>
          <div className="flex justify-between pt-2 font-display text-xl"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      </div>

      <ConfirmDialog open={cancelOpen} title="Cancel this order?" confirmLabel="Cancel order" danger busy={busy} onConfirm={cancel} onClose={() => setCancelOpen(false)}
        message="The gifts go back on the shelf. If you paid online, the refund is started.">
        <label className="mt-4 block">
          <span className="label">Reason (optional)</span>
          <input className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Changed my mind" />
        </label>
      </ConfirmDialog>

      {payment && <PaymentModal payment={payment} onClose={() => setPayment(null)} onPaid={(o) => { setPayment(null); setData({ order: { ...order, ...o } }); }} />}
    </div>
  );
}
