import { Link } from 'react-router-dom';
import useTitle from '../hooks/useTitle';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <div className="page flex min-h-[55vh] flex-col items-center justify-center text-center">
      <p className="font-display text-8xl text-rose">404</p>
      <h1 className="mt-2 text-4xl">This page isn't here</h1>
      <p className="mt-3 text-muted">The link may be old, or the page was moved.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn-primary">Go to home</Link>
        <Link to="/shop" className="btn-outline">Browse gifts</Link>
      </div>
    </div>
  );
}
