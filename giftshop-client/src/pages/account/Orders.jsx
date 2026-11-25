import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { imageUrl } from '../../api/client';
import { EmptyState, ErrorState, Pagination, Skeleton } from '../../components/ui';
import { STATUS_CHIP } from '../../utils/constants';
import { date, money, plural } from '../../utils/format';

export default function Orders() {
  useTitle('Your orders');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi('/orders/my', { params: { page, limit: 10 } });

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!data.orders.length) {
    return <EmptyState icon={Package} title="No orders yet" action={<Link to="/shop" className="btn-primary">Find a gift</Link>}>When you place an order, you can track it here.</EmptyState>;
  }

  return (
    <div>
      <ul className="space-y-3">
        {data.orders.map((o) => (
          <li key={o._id}>
            <Link to={`/account/orders/${o._id}`} className="card flex flex-wrap items-center gap-4 p-4 transition-colors hover:border-accent">
              <div className="flex -space-x-3">
                {o.items.slice(0, 3).map((i) => <img key={`${i.product}-${i.variant}`} src={imageUrl(i.image)} alt="" className="h-12 w-12 rounded-lg border-2 border-surface object-cover" />)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{o.orderNumber}</p>
                <p className="text-sm text-muted">{date(o.createdAt)}, {plural(o.items.reduce((s, i) => s + i.qty, 0), 'item')}</p>
              </div>
              <div className="flex items-center gap-2">
                {o.paymentMethod === 'ONLINE' && o.paymentStatus === 'Pending' && o.status !== 'Cancelled' && <span className="chip-rose">Payment due</span>}
                <span className={STATUS_CHIP[o.status]}>{o.status}</span>
              </div>
              <p className="w-24 text-right font-display text-lg">{money(o.total)}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={page} pages={data.pages} onChange={setPage} />
    </div>
  );
}
