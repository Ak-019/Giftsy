import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { useAuth } from '../../context/AuthContext';
import { ProductGrid } from '../../components/ProductCard';
import { EmptyState, ErrorState } from '../../components/ui';

export default function Wishlist() {
  useTitle('Wishlist');
  const { user } = useAuth();
  // Re-fetch when the wishlist changes (e.g. a heart is un-ticked on this page)
  const { data, loading, error, reload } = useApi('/account/wishlist', { params: { n: user.wishlist?.length } });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const items = (data?.wishlist || []).filter((p) => user.wishlist?.includes(p._id));
  if (!loading && !items.length) {
    return <EmptyState icon={Heart} title="Nothing saved yet" action={<Link to="/shop" className="btn-primary">Browse gifts</Link>}>Tap the heart on any gift to keep it here for later.</EmptyState>;
  }
  return <ProductGrid products={items} loading={loading && !data} count={4} />;
}
