import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { imageUrl, PLACEHOLDER_IMG } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { money, discountPercent } from '../utils/format';
import { Skeleton, Stars } from './ui';

export default function ProductCard({ product, reasons, chipClass = 'chip-lavender' }) {
  const { inWishlist, toggleWishlist } = useAuth();
  const saved = inWishlist(product._id);
  const off = discountPercent(product.price, product.finalPrice);
  const soldOut = product.stock <= 0;

  return (
    <article className="group relative flex flex-col">
      <Link to={`/product/${product.slug}`} className="relative block overflow-hidden rounded-card bg-surface">
        <img
          src={imageUrl(product.images?.[0])}
          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
          alt={product.name}
          loading="lazy"
          width="400"
          height="400"
          className={`aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${soldOut ? 'opacity-60 grayscale' : ''}`}
        />
        <span className="gift-tag absolute bottom-3 left-0 shadow-sm">{money(product.finalPrice ?? product.price)}</span>
        {off > 0 && <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">{off}% off</span>}
        {soldOut && <span className="absolute right-3 top-3 rounded-full bg-plum px-2 py-0.5 text-xs font-semibold text-cream">Sold out</span>}
      </Link>
      <button
        type="button"
        onClick={() => toggleWishlist(product._id)}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        className="absolute left-3 top-3 rounded-full bg-surface/90 p-2 shadow-sm transition hover:scale-105"
      >
        <Heart className={`h-4 w-4 ${saved ? 'fill-rose text-rose' : 'text-ink'}`} />
      </button>
      <div className="mt-3 flex flex-1 flex-col gap-1 px-0.5">
        <Link to={`/product/${product.slug}`} className="font-medium leading-snug text-ink hover:text-accent">{product.name}</Link>
        <div className="flex items-center gap-2 text-xs text-muted">
          {product.ratingCount > 0 ? (<><Stars value={product.ratingAvg} size="h-3.5 w-3.5" /><span>({product.ratingCount})</span></>) : <span>No reviews yet</span>}
          {off > 0 && <span className="line-through">{money(product.price)}</span>}
        </div>
        {reasons?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">{reasons.map((r) => <span key={r} className={chipClass}>{r}</span>)}</div>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full rounded-card" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  );
}

export function ProductGrid({ products, loading, count = 8, reasonsKey, chipClass }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {loading
        ? Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p) => <ProductCard key={p._id} product={p} reasons={reasonsKey ? p[reasonsKey] : undefined} chipClass={chipClass} />)}
    </div>
  );
}
