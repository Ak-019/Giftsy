import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { useTheme } from '../../context/ThemeContext';
import { ErrorState, Skeleton } from '../../components/ui';
import { STATUS_CHIP } from '../../utils/constants';
import { dateTime, money } from '../../utils/format';
import { AdminTitle, Table } from './AdminLayout';

const shortDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const compact = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₹${n}`);

function Stat({ label, value, note }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-md">
      <p className="text-muted">{shortDay(label)}</p>
      <p className="font-semibold text-ink">{format(payload[0].value)}</p>
    </div>
  );
}

// One chart per measure (revenue and order count use different scales, so no shared axis)
function DayChart({ title, data, dataKey, kind, color, format, axisFormat }) {
  const { dark } = useTheme();
  const ink = dark ? '#C9A9B6' : '#7A5A6A';
  const grid = dark ? '#563C4A' : '#E5CFC2';
  const Chart = kind === 'line' ? LineChart : BarChart;
  return (
    <figure className="card p-5">
      <figcaption className="mb-4 font-display text-xl">{title}</figcaption>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: ink, fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={axisFormat} tick={{ fill: ink, fontSize: 12 }} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
            <Tooltip content={<ChartTooltip format={format} />} cursor={kind === 'line' ? { stroke: ink, strokeDasharray: '3 3' } : { fill: dark ? '#ffffff10' : '#5E3A4D10' }} />
            {kind === 'line'
              ? <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: dark ? '#3A2531' : '#FBF3EC' }} />
              : <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={18} />}
          </Chart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default function Dashboard() {
  useTitle('Admin dashboard');
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useApi('/admin/stats', { params: { days } });
  const { dark } = useTheme();

  if (error) return <ErrorState message={error} onRetry={reload} />;
  const t = data?.totals;
  const statusTotal = data ? Object.values(data.statusBreakdown).reduce((a, b) => a + b, 0) : 0;

  return (
    <div>
      <AdminTitle title="Dashboard">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Showing</span>
          <select className="input w-auto py-1.5" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
        </label>
      </AdminTitle>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Revenue" value={money(t.revenue)} note="Excludes cancelled orders" />
            <Stat label="Orders" value={t.orders} note={`${t.pendingOrders} waiting to ship`} />
            <Stat label="Average order" value={money(t.avgOrderValue)} />
            <Stat label="Customers" value={t.customers} note={`${t.products} products in the shop`} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <DayChart title="Revenue per day" data={data.ordersPerDay} dataKey="revenue" kind="line" color={dark ? '#E4A9B6' : '#9B4A5F'} format={money} axisFormat={compact} />
            <DayChart title="Orders per day" data={data.ordersPerDay} dataKey="orders" kind="bar" color={dark ? '#A7B0D6' : '#5E3A4D'} format={(n) => `${n} order${n === 1 ? '' : 's'}`} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <section className="card p-5" aria-labelledby="status-h">
              <h2 id="status-h" className="mb-4 text-xl">Orders by status</h2>
              <ul className="space-y-3">
                {Object.entries(data.statusBreakdown).map(([status, n]) => (
                  <li key={status}>
                    <Link to={`/admin/orders?status=${status}`} className="group flex items-center gap-3 text-sm">
                      <span className="w-20 group-hover:text-accent">{status}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                        <span className="block h-full rounded-full bg-plum dark:bg-lavender" style={{ width: `${statusTotal ? (n / statusTotal) * 100 : 0}%` }} />
                      </span>
                      <span className="w-8 text-right font-semibold">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card p-5" aria-labelledby="top-h">
              <h2 id="top-h" className="mb-4 text-xl">Best sellers</h2>
              {data.topProducts.length === 0 ? <p className="text-sm text-muted">No sales in this period.</p> : (
                <ol className="space-y-2.5 text-sm">
                  {data.topProducts.map((p) => (
                    <li key={p.productId} className="flex justify-between gap-3"><span>{p.name}</span><span className="text-muted">{p.sold} sold, {money(p.revenue)}</span></li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
            <section className="card p-5" aria-labelledby="low-h">
              <h2 id="low-h" className="mb-1 text-xl">Running low</h2>
              <p className="mb-4 text-xs text-muted">{data.lowStockThreshold} or fewer left</p>
              {data.lowStock.length === 0 ? <p className="text-sm text-muted">Everything is well stocked.</p> : (
                <ul className="space-y-2 text-sm">
                  {data.lowStock.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-3">
                      <span>{p.name}</span>
                      <span className={p.stock === 0 ? 'chip-rose' : 'chip-muted'}>{p.stock === 0 ? 'Sold out' : `${p.stock} left`}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/admin/products?sort=stock" className="link mt-4 inline-block text-sm">Update stock</Link>
            </section>
            <section aria-labelledby="recent-h">
              <h2 id="recent-h" className="mb-3 text-xl">Latest orders</h2>
              <Table head={['Order', 'Customer', 'Total', 'Status', 'Placed']}>
                {data.recentOrders.map((o) => (
                  <tr key={o._id}>
                    <td className="px-4 py-3"><Link to={`/admin/orders?search=${o.orderNumber}`} className="link">{o.orderNumber}</Link></td>
                    <td className="px-4 py-3">{o.user?.name}</td>
                    <td className="px-4 py-3">{money(o.total)}</td>
                    <td className="px-4 py-3"><span className={STATUS_CHIP[o.status]}>{o.status}</span></td>
                    <td className="px-4 py-3 text-muted">{dateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
