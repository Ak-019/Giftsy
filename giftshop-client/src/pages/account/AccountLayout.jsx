import { NavLink, Outlet } from 'react-router-dom';
import { CalendarHeart, Heart, MapPin, Package, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const LINKS = [
  ['/account', 'Profile', User, true],
  ['/account/orders', 'Orders', Package],
  ['/account/wishlist', 'Wishlist', Heart],
  ['/account/addresses', 'Addresses', MapPin],
  ['/account/occasions', 'Reminders', CalendarHeart],
];

export default function AccountLayout() {
  const { user } = useAuth();
  return (
    <div className="page pt-8">
      <h1 className="text-4xl sm:text-5xl">Hi, {user.name.split(' ')[0]}</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-[210px_1fr]">
        <nav aria-label="Account" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
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
