import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage, imageUrl } from '../../api/client';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import useTitle from '../../hooks/useTitle';
import StatusTimeline from '../../components/StatusTimeline';
import { ErrorState, Modal, Pagination, Spinner } from '../../components/ui';
import { PAYMENT_STATUSES, STATUS_CHIP, STATUS_TRANSITIONS } from '../../utils/constants';
import { date, dateTime, money } from '../../utils/format';
import { downloadInvoice } from '../account/OrderDetail';
import { AdminTitle, Table } from './AdminLayout';

function OrderPanel({ order, onUpdated }) {
  const next = STATUS_TRANSITIONS[order.status];
  const [status, setStatus] = useState(next[0] || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const unpaid = order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'Paid';
  const a = order.shippingAddress;

  const update = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(`/admin/orders/${order._id}/status`, { status, ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success(`Order marked ${status}`);
      onUpdated({ ...order, ...data.order, user: order.user });
      setNote('');
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <StatusTimeline order={order} />
      {next.length > 0 ? (
        <div className="rounded-xl bg-bg p-4">
          <p className="mb-3 font-semibold">Update status</p>
          {unpaid && <p className="mb-3 text-sm text-accent">Waiting for online payment. It can only be cancelled until paid.</p>}
          <div className="flex flex-wrap gap-2">
            <label htmlFor="ns" className="sr-only">New status</label>
            <select id="ns" className="input w-auto py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
              {next.map((s) => <option key={s} value={s} disabled={unpaid && s !== 'Cancelled'}>{s}</option>)}
            </select>
            <label htmlFor="nn" className="sr-only">Note</label>
            <input id="nn" className="input flex-1 py-2" maxLength={200} placeholder="Note (optional), e.g. courier tracking number" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className={status === 'Cancelled' ? 'btn-accent btn-sm' : 'btn-primary btn-sm'} onClick={update} disabled={busy || !status || (unpaid && status !== 'Cancelled')}>
              {busy && <Spinner className="h-4 w-4" />}{status === 'Cancelled' ? 'Cancel order' : `Mark ${status}`}
            </button>
          </div>
        </div>
      ) : <p className="text-sm text-muted">This order is {order.status.toLowerCase()}. No further changes.</p>}

      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold">Ship to</p>
          <p className="text-muted">{a.fullName}, {a.phone}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.pincode}</p>
          <p className="mt-2 text-muted">{order.deliveryDate ? `Deliver on ${date(order.deliveryDate)}` : 'Standard delivery'}</p>
        </div>
        <div>
          <p className="font-semibold">Gift</p>
          <p className="text-muted">{order.giftWrap ? 'Gift wrap' : 'No gift wrap'}{order.shipToSomeoneElse ? ', shipped to recipient' : ''}</p>
          {order.giftMessage && <p className="mt-1 italic">“{order.giftMessage}”</p>}
          <p className="mt-2"><span className="text-muted">Payment:</span> {order.paymentMethod} <span className={STATUS_CHIP[order.paymentStatus]}>{order.paymentStatus}</span></p>
        </div>
      </div>
      <ul className="divide-y divide-line text-sm">
        {order.items.map((i) => (
          <li key={`${i.product}-${i.variant}`} className="flex items-center gap-3 py-2">
            <img src={imageUrl(i.image)} alt="" className="h-10 w-10 rounded object-cover" />
            <span className="flex-1">{i.name}{i.variant ? ` (${i.variant})` : ''} × {i.qty}</span><span>{money(i.price * i.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between pt-3 font-semibold"><span>Total{order.couponCode ? ` (coupon ${order.couponCode})` : ''}</span><span>{money(order.total)}</span></li>
      </ul>
      <button type="button" className="btn-outline btn-sm" onClick={() => downloadInvoice(order)}><Download className="h-4 w-4" />Invoice</button>
    </div>
  );
}

export default function AdminOrders() {
  useTitle('Orders');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounce(search.trim(), 300);
  const query = Object.fromEntries([...params.entries()].filter(([k, v]) => v && k !== 'search'));
  const page = Number(query.page || 1);
  const { data, setData, loading, error, reload } = useApi('/admin/orders', { params: { ...query, ...(debounced ? { search: debounced } : {}), limit: 20 } });
  const [open, setOpen] = useState(null);

  const setParam = (k, v) => { const next = new URLSearchParams(params); if (v) next.set(k, v); else next.delete(k); if (k !== 'page') next.delete('page'); setParams(next); };
  const updated = (order) => {
    setOpen(order);
    setData((d) => ({ ...d, orders: d.orders.map((o) => (o._id === order._id ? order : o)) }));
  };

  return (
    <div>
      <AdminTitle title="Orders" />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="os" className="sr-only">Search orders</label>
          <input id="os" className="input py-2 pl-9" placeholder="Order number, name or email" value={search} onChange={(e) => { setSearch(e.target.value); setParam('page', ''); }} />
        </div>
        <label className="sr-only" htmlFor="fs">Status</label>
        <select id="fs" className="input w-auto py-2" value={query.status || ''} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">All statuses</option>{Object.keys(STATUS_TRANSITIONS).map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="sr-only" htmlFor="fp">Payment</label>
        <select id="fp" className="input w-auto py-2" value={query.paymentStatus || ''} onChange={(e) => setParam('paymentStatus', e.target.value)}>
          <option value="">All payments</option>{PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><span className="text-muted">From</span><input type="date" className="input w-auto py-2" value={query.from || ''} onChange={(e) => setParam('from', e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><span className="text-muted">To</span><input type="date" className="input w-auto py-2" value={query.to || ''} onChange={(e) => setParam('to', e.target.value ? `${e.target.value}T23:59:59` : '')} /></label>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table head={['Order', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Placed']} empty={!loading && data?.orders.length === 0 ? 'No orders match these filters' : null}>
          {(data?.orders || []).map((o) => (
            <tr key={o._id} className={`cursor-pointer hover:bg-ink/5 ${loading ? 'opacity-60' : ''}`} onClick={() => setOpen(o)}>
              <td className="px-4 py-3"><button type="button" className="link" onClick={(e) => { e.stopPropagation(); setOpen(o); }}>{o.orderNumber}</button></td>
              <td className="px-4 py-3">{o.user?.name}<span className="block text-xs text-muted">{o.user?.email}</span></td>
              <td className="px-4 py-3">{o.items.reduce((s, i) => s + i.qty, 0)}</td>
              <td className="px-4 py-3">{money(o.total)}</td>
              <td className="px-4 py-3"><span className={STATUS_CHIP[o.paymentStatus]}>{o.paymentMethod === 'COD' ? 'COD' : 'Online'}: {o.paymentStatus}</span></td>
              <td className="px-4 py-3"><span className={STATUS_CHIP[o.status]}>{o.status}</span></td>
              <td className="px-4 py-3 text-muted">{dateTime(o.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={page} pages={data?.pages} onChange={(p) => setParam('page', String(p))} />
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `Order ${open.orderNumber}` : ''} wide>
        {open && <OrderPanel key={`${open._id}-${open.status}`} order={open} onUpdated={updated} />}
      </Modal>
    </div>
  );
}
