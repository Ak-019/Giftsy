import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';
import { safeRedirect } from '../utils/format';

// The backend enforces every permission; these guards only decide what to show.
export function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user, ready, isAdmin } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Login and register pages. Once logged in, go where the user was heading (?next=), or the
// dashboard for admins. This guard reacts first after a login, so it must pick the same place.
export function GuestOnly() {
  const { user, ready } = useAuth();
  const [params] = useSearchParams();
  if (!ready) return <PageLoader />;
  if (!user) return <Outlet />;
  const next = params.get('next');
  return <Navigate to={user.role === 'admin' && !next ? '/admin' : safeRedirect(next)} replace />;
}
