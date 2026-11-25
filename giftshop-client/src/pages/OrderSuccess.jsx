import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import { ErrorState, PageLoader } from '../components/ui';
import { date, money } from '../utils/format';

export default function OrderSuccess() {
  useTitle('Order placed');
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/orders/${id}`);
  if (loading) return <PageLoader />;
  if (error) return <div className="page"><ErrorState message={error} onRetry={reload} /></div>;
  const { order } = data;

  return (
    <div className="page max-w-2xl pt-14 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-sage" strokeWidth={1.5} aria-hidden="true" />
      <h1 className="mt-4 text-5xl">Thank you, it's on its way</h1>
      <p className="mt-3 text-muted">Order <b className="text-ink">{order.orderNumber}</b> is confirmed. We've sent the details to your email.</p>
      <div className="card mt-8 p-6 text-left">
        <ul className="space-y-2 text-sm">
          {order.items.map((i) => (
            <li key={`${i.product}-${i.variant}`} className="flex justify-between gap-3"><span>{i.name}{i.variant ? ` (${i.variant})` : ''} × {i.qty}</span><span>{money(i.price * i.qty)}</span></li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-4 font-display text-xl"><span>Total</span><span>{money(order.total)}</span></div>
        <p className="mt-4 text-sm text-muted">
          {order.deliveryDate ? `Delivering on ${date(order.deliveryDate)}` : 'Delivering in 3 to 7 days'} to {order.shippingAddress.fullName}, {order.shippingAddress.city}.
          {order.paymentMethod === 'COD' ? ' Pay in cash when it arrives.' : order.paymentStatus === 'Paid' ? ' Payment received.' : ''}
        </p>
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <Link to={`/account/orders/${order._id}`} className="btn-primary">Track this order</Link>
        <Link to="/shop" className="btn-outline">Keep shopping</Link>
      </div>
    </div>
  );
}
