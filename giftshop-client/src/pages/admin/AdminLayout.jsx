import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Gift, MessageSquare, Package, Ticket, Users } from 'lucide-react';

const LINKS = [
  ['/admin', 'Dashboard', BarChart3, true],
  ['/admin/orders', 'Orders', Package],
  ['/admin/products', 'Products', Gift],
  ['/admin/coupons', 'Coupons', Ticket],
  ['/admin/users', 'Customers', Users],
  ['/admin/reviews', 'Reviews', MessageSquare],
];

export default function AdminLayout() {
  return (
    <div className="page pt-8">
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:h-fit lg:flex-col lg:px-0">
          <p className="mb-2 hidden px-4 font-display text-xl lg:block">Shop admin</p>
          {LINKS.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium ${isActive ? 'bg-brand text-brand-ink' : 'hover:bg-ink/5'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}

export function AdminTitle({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-4xl">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// Plain table wrapper that scrolls sideways on small screens
export function Table({ head, children, empty }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line text-xs text-muted">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-muted">{empty}</p>}
    </div>
  );
}
