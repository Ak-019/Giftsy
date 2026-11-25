import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Heart, LayoutDashboard, LogOut, Menu, Moon, ShoppingBag, Sun, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { money, plural } from '../utils/format';
import SearchBox from './SearchBox';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Giftsy home">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="font-display text-2xl font-medium tracking-tight text-ink">Giftsy</span>
    </Link>
  );
}

const navClass = ({ isActive }) => `rounded-full px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-ink/10 text-ink' : 'text-ink/80 hover:text-ink'}`;

function Header() {
  const { user, isAdmin, logout } = useAuth();
  const { cart } = useCart();
  const { dark, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const doLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
      <div className="page flex h-16 items-center gap-4">
        <button type="button" className="btn-ghost -ml-2 p-2 md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/shop" className={navClass}>Shop</NavLink>
          <NavLink to="/gift-finder" className={navClass}>Gift Finder</NavLink>
          {isAdmin && <NavLink to="/admin" className={navClass}>Admin</NavLink>}
        </nav>
        <SearchBox className="mx-auto hidden w-full max-w-sm lg:block" />
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button type="button" className="btn-ghost p-2" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {user ? (
            <>
              <Link to="/account/wishlist" className="btn-ghost hidden p-2 sm:inline-flex" aria-label="Wishlist"><Heart className="h-5 w-5" /></Link>
              <Link to="/account" className="btn-ghost p-2" aria-label="My account"><User className="h-5 w-5" /></Link>
              <button type="button" className="btn-ghost hidden p-2 sm:inline-flex" onClick={doLogout} aria-label="Log out"><LogOut className="h-5 w-5" /></button>
            </>
          ) : (
            <Link to="/login" className="btn-ghost text-sm">Log in</Link>
          )}
          <Link to="/cart" className="btn-ghost relative p-2" aria-label={`Cart, ${plural(cart.itemCount, 'item')}`}>
            <ShoppingBag className="h-5 w-5" />
            {cart.itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white dark:text-plum">{cart.itemCount}</span>
            )}
          </Link>
        </div>
      </div>
      <div className="page pb-3 lg:hidden"><SearchBox /></div>
      {menuOpen && (
        <nav className="page flex flex-col gap-1 border-t border-line py-3 md:hidden" aria-label="Mobile">
          <NavLink to="/shop" className={navClass}>Shop</NavLink>
          <NavLink to="/gift-finder" className={navClass}>Gift Finder</NavLink>
          {user && <NavLink to="/account/wishlist" className={navClass}>Wishlist</NavLink>}
          {user && <NavLink to="/account/orders" className={navClass}>My orders</NavLink>}
          {isAdmin && <NavLink to="/admin" className={navClass}><LayoutDashboard className="mr-1 inline h-4 w-4" />Admin</NavLink>}
          {user && <button type="button" className="rounded-full px-3 py-1.5 text-left text-sm font-medium text-ink/80" onClick={doLogout}>Log out</button>}
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 bg-plum text-cream">
      <div className="page grid gap-10 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl">Giftsy</p>
          <p className="mt-2 max-w-xs text-sm text-cream/80">Wrapped by hand, delivered in 3 to 7 days, with your message tucked inside.</p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">Shop</p>
          <ul className="space-y-2 text-cream/80">
            <li><Link to="/shop?occasion=Birthday" className="hover:text-cream">Birthday gifts</Link></li>
            <li><Link to="/shop?occasion=Anniversary" className="hover:text-cream">Anniversary gifts</Link></li>
            <li><Link to="/gift-finder" className="hover:text-cream">Gift Finder</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">Your account</p>
          <ul className="space-y-2 text-cream/80">
            <li><Link to="/account/orders" className="hover:text-cream">Track an order</Link></li>
            <li><Link to="/account/occasions" className="hover:text-cream">Birthday reminders</Link></li>
            <li><Link to="/account/wishlist" className="hover:text-cream">Wishlist</Link></li>
          </ul>
        </div>
      </div>
      <p className="page border-t border-cream/15 py-5 text-xs text-cream/70">A demo shop built for learning. No real orders are shipped.</p>
    </footer>
  );
}

// Sticky bar on small screens so the cart is always one tap away
function MobileCartBar() {
  const { cart } = useCart();
  const { pathname } = useLocation();
  if (!cart.itemCount || ['/cart', '/checkout'].includes(pathname) || pathname.startsWith('/admin')) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur sm:hidden">
      <Link to="/cart" className="btn-primary w-full justify-between">
        <span>{plural(cart.itemCount, 'item')} in your cart</span>
        <span>{money(cart.total)}</span>
      </Link>
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1 pb-20 sm:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileCartBar />
    </div>
  );
}
