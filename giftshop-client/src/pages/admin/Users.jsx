import { useState } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import useDebounce from '../../hooks/useDebounce';
import useTitle from '../../hooks/useTitle';
import { ConfirmDialog, ErrorState, Pagination } from '../../components/ui';
import { date, money } from '../../utils/format';
import { AdminTitle, Table } from './AdminLayout';

export default function Users() {
  useTitle('Customers');
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search.trim(), 300);
  const params = { page, limit: 20, ...(debounced ? { search: debounced } : {}), ...(filter === 'admin' ? { role: 'admin' } : filter === 'blocked' ? { blocked: 'true' } : {}) };
  const { data, setData, loading, error, reload } = useApi('/admin/users', { params });
  const [confirm, setConfirm] = useState(null);

  const setBlocked = async (u, isBlocked) => {
    try {
      await api.put(`/admin/users/${u._id}/block`, { isBlocked });
      setData((d) => ({ ...d, users: d.users.map((x) => (x._id === u._id ? { ...x, isBlocked } : x)) }));
      toast.success(isBlocked ? `${u.name} is blocked and logged out` : `${u.name} can log in again`);
    } catch (err) { toast.error(errorMessage(err)); }
    setConfirm(null);
  };

  return (
    <div>
      <AdminTitle title="Customers" />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="us" className="sr-only">Search customers</label>
          <input id="us" className="input py-2 pl-9" placeholder="Name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <label htmlFor="uf" className="sr-only">Show</label>
        <select id="uf" className="input w-auto py-2" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
          <option value="">Everyone</option><option value="blocked">Blocked</option><option value="admin">Admins</option>
        </select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table head={['Name', 'Email', 'Orders', 'Spent', 'Joined', '']} empty={!loading && data?.users.length === 0 ? 'No customers found' : null}>
          {(data?.users || []).map((u) => (
            <tr key={u._id} className={loading ? 'opacity-60' : ''}>
              <td className="px-4 py-3 font-medium">{u.name}{u.role === 'admin' && <span className="chip-lavender ml-2">Admin</span>}{u.isBlocked && <span className="chip-rose ml-2">Blocked</span>}</td>
              <td className="px-4 py-3">{u.email}</td>
              <td className="px-4 py-3">{u.orders}</td>
              <td className="px-4 py-3">{money(u.spent)}</td>
              <td className="px-4 py-3 text-muted">{date(u.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                {u.role !== 'admin' && u._id !== me._id && (
                  u.isBlocked
                    ? <button type="button" className="link text-xs" onClick={() => setBlocked(u, false)}>Unblock</button>
                    : <button type="button" className="text-xs font-medium text-danger hover:underline" onClick={() => setConfirm(u)}>Block</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />
      <ConfirmDialog open={Boolean(confirm)} title={`Block ${confirm?.name}?`} message="They'll be logged out right away and can't log in or place orders until you unblock them."
        confirmLabel="Block customer" danger onClose={() => setConfirm(null)} onConfirm={() => setBlocked(confirm, true)} />
    </div>
  );
}
