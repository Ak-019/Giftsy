import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage, imageUrl } from '../../api/client';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import useTitle from '../../hooks/useTitle';
import { ConfirmDialog, ErrorState, Pagination, Spinner } from '../../components/ui';
import { money } from '../../utils/format';
import { AdminTitle, Table } from './AdminLayout';

export default function Products() {
  useTitle('Products');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounce(search.trim(), 300);
  const page = Number(params.get('page') || 1);
  const sort = params.get('sort') || 'newest';
  const { data, loading, error, reload } = useApi('/products', { params: { page, limit: 20, sort, ...(debounced ? { search: debounced } : {}) } });
  const [stockEdits, setStockEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const setParam = (k, v) => { const next = new URLSearchParams(params); if (v) next.set(k, v); else next.delete(k); if (k !== 'page') next.delete('page'); setParams(next); };
  const changed = Object.entries(stockEdits).filter(([id, v]) => data?.products.find((p) => p._id === id)?.stock !== v);

  const saveStock = async () => {
    setSaving(true);
    try {
      await api.patch('/admin/products/stock', { items: changed.map(([id, stock]) => ({ id, stock })) });
      toast.success(`Stock updated for ${changed.length} product${changed.length > 1 ? 's' : ''}`);
      setStockEdits({});
      reload();
    } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  const remove = async () => {
    try {
      await api.delete(`/products/${deleting._id}`);
      toast.success('Product deleted');
      reload();
    } catch (err) { toast.error(errorMessage(err)); }
    setDeleting(null);
  };

  return (
    <div>
      <AdminTitle title="Products">
        {changed.length > 0 && <button type="button" className="btn-accent btn-sm" onClick={saveStock} disabled={saving}>{saving && <Spinner className="h-4 w-4" />}Save stock for {changed.length}</button>}
        <Link to="/admin/products/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" />New product</Link>
      </AdminTitle>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="ps" className="sr-only">Search products</label>
          <input id="ps" className="input py-2 pl-9" placeholder="Search products" value={search} onChange={(e) => { setSearch(e.target.value); setParam('page', ''); }} />
        </div>
        <label className="flex items-center gap-2 text-sm"><span className="text-muted">Sort</span>
          <select className="input w-auto py-2" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
            <option value="newest">Newest</option><option value="stock">Lowest stock</option><option value="popular">Best selling</option><option value="priceAsc">Price: low to high</option><option value="priceDesc">Price: high to low</option>
          </select>
        </label>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table head={['', 'Product', 'Price', 'Stock', 'Sold', 'Rating', '']} empty={!loading && data?.products.length === 0 ? 'No products found' : null}>
          {(data?.products || []).map((p) => (
            <tr key={p._id} className={loading ? 'opacity-60' : ''}>
              <td className="py-2 pl-4"><img src={imageUrl(p.images?.[0])} alt="" className="h-11 w-11 rounded-lg object-cover" /></td>
              <td className="px-4 py-2">
                <Link to={`/admin/products/${p._id}/edit`} className="font-medium hover:text-accent">{p.name}</Link>
                <p className="text-xs text-muted">{p.category}{p.isFeatured ? ', featured' : ''}{p.variants?.length ? `, ${p.variants.length} options` : ''}</p>
              </td>
              <td className="px-4 py-2">{money(p.finalPrice)}{p.discountPrice != null && <span className="block text-xs text-muted line-through">{money(p.price)}</span>}</td>
              <td className="px-4 py-2">
                <label className="sr-only" htmlFor={`stock-${p._id}`}>Stock for {p.name}</label>
                <input id={`stock-${p._id}`} type="number" min="0" className={`input w-20 py-1.5 ${p.stock <= 5 ? 'border-accent' : ''}`}
                  value={stockEdits[p._id] ?? p.stock}
                  onChange={(e) => setStockEdits({ ...stockEdits, [p._id]: Math.max(0, parseInt(e.target.value || '0', 10)) })} />
              </td>
              <td className="px-4 py-2">{p.soldCount}</td>
              <td className="px-4 py-2">{p.ratingCount ? `${p.ratingAvg} (${p.ratingCount})` : '–'}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <Link to={`/product/${p.slug}`} className="link mr-3 text-xs">View</Link>
                <Link to={`/admin/products/${p._id}/edit`} className="link mr-3 text-xs">Edit</Link>
                <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => setDeleting(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={page} pages={data?.pages} onChange={(p) => setParam('page', String(p))} />
      <ConfirmDialog open={Boolean(deleting)} title="Delete this product?" message={`"${deleting?.name}" will be removed from the shop, carts and wishlists. Past orders keep their copy.`}
        confirmLabel="Delete product" danger onConfirm={remove} onClose={() => setDeleting(null)} />
    </div>
  );
}
