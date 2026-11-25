import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../../api/client';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { ConfirmDialog, ErrorState, Pagination, Stars } from '../../components/ui';
import { date } from '../../utils/format';
import { AdminTitle, Table } from './AdminLayout';

export default function Reviews() {
  useTitle('Reviews');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi('/admin/reviews', { params: { page, limit: 20, ...(rating ? { rating } : {}) } });
  const [deleting, setDeleting] = useState(null);

  return (
    <div>
      <AdminTitle title="Reviews">
        <label htmlFor="rf" className="sr-only">Rating</label>
        <select id="rf" className="input w-auto py-2" value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }}>
          <option value="">All ratings</option>{[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r} star{r > 1 ? 's' : ''}</option>)}
        </select>
      </AdminTitle>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table head={['Product', 'Customer', 'Rating', 'Review', 'Date', '']} empty={!loading && data?.reviews.length === 0 ? 'No reviews found' : null}>
          {(data?.reviews || []).map((r) => (
            <tr key={r._id} className={loading ? 'opacity-60' : ''}>
              <td className="px-4 py-3">{r.product ? <Link to={`/product/${r.product.slug}`} className="link">{r.product.name}</Link> : 'Deleted product'}</td>
              <td className="px-4 py-3">{r.user?.name}<span className="block text-xs text-muted">{r.user?.email}</span></td>
              <td className="px-4 py-3"><Stars value={r.rating} size="h-3.5 w-3.5" /></td>
              <td className="max-w-xs px-4 py-3">{r.comment || <span className="text-muted">No comment</span>}</td>
              <td className="px-4 py-3 text-muted">{date(r.createdAt)}</td>
              <td className="px-4 py-3 text-right"><button type="button" className="text-xs font-medium text-danger hover:underline" onClick={() => setDeleting(r)}>Delete</button></td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />
      <ConfirmDialog open={Boolean(deleting)} title="Delete this review?" message="The product's rating is recalculated without it." confirmLabel="Delete review" danger onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try { await api.delete(`/reviews/${deleting._id}`); toast.success('Review deleted'); reload(); } catch (err) { toast.error(errorMessage(err)); }
          setDeleting(null);
        }} />
    </div>
  );
}
