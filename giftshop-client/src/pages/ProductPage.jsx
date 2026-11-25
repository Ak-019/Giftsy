import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, PackageCheck, ShoppingBag, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage, imageUrl, PLACEHOLDER_IMG } from '../api/client';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ProductGrid } from '../components/ProductCard';
import { ErrorState, Pagination, Price, QtyStepper, Skeleton, Spinner, StarInput, Stars, StockNote } from '../components/ui';
import { date, money, plural } from '../utils/format';
import NotFound from './NotFound';

function Gallery({ images, name }) {
  const [active, setActive] = useState(0);
  const list = images?.length ? images : [null];
  useEffect(() => { setActive(0); }, [images]);
  return (
    <div>
      <div className="overflow-hidden rounded-card bg-surface">
        <img src={imageUrl(list[active])} onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} alt={name} className="aspect-square w-full object-cover" />
      </div>
      {list.length > 1 && (
        <div className="mt-3 flex gap-3">
          {list.map((src, i) => (
            <button type="button" key={src || i} onClick={() => setActive(i)} aria-label={`Show image ${i + 1}`} aria-pressed={i === active}
              className={`overflow-hidden rounded-lg border-2 ${i === active ? 'border-accent' : 'border-transparent'}`}>
              <img src={imageUrl(src)} alt="" className="h-16 w-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingBars({ breakdown, count }) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((r) => {
        const n = breakdown?.[r] || 0;
        const pct = count ? Math.round((n / count) * 100) : 0;
        return (
          <div key={r} className="flex items-center gap-3 text-sm">
            <span className="w-12 text-muted">{r} star</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`${pct}% gave ${r} stars`}>
              <div className="h-full rounded-full bg-rose" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 text-right text-muted">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewForm({ productId, existing, onSaved, onCancel }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { toast.error('Choose a star rating'); return; }
    setBusy(true);
    try {
      if (existing) await api.put(`/reviews/${existing._id}`, { rating, comment });
      else await api.post(`/products/${productId}/reviews`, { rating, comment });
      toast.success(existing ? 'Review updated' : 'Thanks for your review');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <p className="font-display text-xl">{existing ? 'Edit your review' : 'How was it?'}</p>
      <StarInput value={rating} onChange={setRating} />
      <label className="block">
        <span className="label">Your review (optional)</span>
        <textarea className="input min-h-24" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did they think of it?" />
        <span className="mt-1 block text-right text-xs text-muted">{comment.length}/500</span>
      </label>
      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{existing ? 'Save review' : 'Post review'}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function Reviews({ product, detail, onChanged }) {
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const list = useApi(`/products/${product._id}/reviews`, { params: { sort, page, limit: 6 } });

  const saved = () => { setEditing(false); onChanged(); list.reload(); };
  const remove = async () => {
    try {
      await api.delete(`/reviews/${detail.userReview._id}`);
      toast.success('Review deleted');
      saved();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <section className="mt-20 grid gap-10 lg:grid-cols-[300px_1fr]" aria-labelledby="reviews-heading">
      <div>
        <h2 id="reviews-heading" className="text-3xl">Reviews</h2>
        <div className="mt-4 flex items-center gap-3">
          <span className="font-display text-5xl">{product.ratingCount ? product.ratingAvg.toFixed(1) : '–'}</span>
          <div><Stars value={product.ratingAvg} /><p className="text-sm text-muted">{plural(product.ratingCount, 'review')}</p></div>
        </div>
        <div className="mt-5"><RatingBars breakdown={detail.ratingBreakdown} count={product.ratingCount} /></div>
      </div>
      <div className="space-y-6">
        {detail.canReview && <ReviewForm productId={product._id} onSaved={saved} />}
        {detail.userReview && (editing
          ? <ReviewForm productId={product._id} existing={detail.userReview} onSaved={saved} onCancel={() => setEditing(false)} />
          : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-sage/30 px-4 py-3 text-sm">
              <span>You rated this {detail.userReview.rating} out of 5.</span>
              <button type="button" className="link" onClick={() => setEditing(true)}>Edit</button>
              <button type="button" className="link" onClick={remove}>Delete</button>
            </div>
          ))}
        {product.ratingCount > 1 && (
          <label className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted">Sort reviews</span>
            <select className="input w-auto py-1.5" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="newest">Newest</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option>
            </select>
          </label>
        )}
        {list.data?.reviews.length === 0 && <p className="text-muted">No reviews yet. Customers can review a gift after ordering it.</p>}
        <ul className="divide-y divide-line">
          {list.data?.reviews.map((r) => (
            <li key={r._id} className="py-5">
              <div className="flex items-center gap-3"><Stars value={r.rating} size="h-3.5 w-3.5" /><span className="font-semibold">{r.user?.name || 'Customer'}</span><span className="text-xs text-muted">{date(r.createdAt)}</span></div>
              {r.comment && <p className="mt-2 max-w-prose text-ink/90">{r.comment}</p>}
            </li>
          ))}
        </ul>
        <Pagination page={page} pages={list.data?.pages} onChange={setPage} />
      </div>
    </section>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const { user, inWishlist, toggleWishlist } = useAuth();
  const { add } = useCart();
  // Order pages link by product id (orders store ids, not slugs); everything else links by slug
  const byId = /^[0-9a-f]{24}$/i.test(slug);
  const { data, loading, error, reload } = useApi(byId ? `/products/${slug}` : `/products/slug/${encodeURIComponent(slug)}`, { params: { u: user?._id } });
  const [variant, setVariant] = useState('');
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  useTitle(data?.product.name || 'Gift');

  useEffect(() => { setVariant(''); setQty(1); }, [slug]);

  if (loading && !data) {
    return (
      <div className="page grid gap-10 pt-10 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-card" />
        <div className="space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /></div>
      </div>
    );
  }
  if (error) return error.includes('not found') ? <NotFound /> : <div className="page"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return null;

  const { product, related } = data;
  const chosen = product.variants.find((v) => v.name === variant);
  const unit = product.finalPrice + (chosen?.priceDelta || 0);
  const soldOut = product.stock <= 0;
  const saved = inWishlist(product._id);

  const addToCart = async () => {
    if (product.variants.length && !variant) { toast.error('Choose an option first'); return; }
    setAdding(true);
    await add(product._id, qty, variant);
    setAdding(false);
  };

  return (
    <div className="page pt-8">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-ink">Shop</Link> <span aria-hidden="true">/</span>{' '}
        <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-ink">{product.category}</Link>
      </nav>
      <div className="grid gap-10 md:grid-cols-2 lg:gap-16">
        <Gallery images={product.images} name={product.name} />
        <div>
          <h1 className="text-4xl sm:text-5xl">{product.name}</h1>
          <a href="#reviews-heading" className="mt-3 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <Stars value={product.ratingAvg} />{product.ratingCount ? plural(product.ratingCount, 'review') : 'No reviews yet'}
          </a>
          <div className="mt-5"><Price price={product.price + (chosen?.priceDelta || 0)} finalPrice={unit} large /></div>
          <div className="mt-3"><StockNote stock={product.stock} /></div>

          {product.variants.length > 0 && (
            <fieldset className="mt-6">
              <legend className="label">Choose an option</legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <label key={v.name} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium ${variant === v.name ? 'border-plum bg-plum text-cream dark:border-cream dark:bg-cream dark:text-plum' : 'border-line hover:border-accent'}`}>
                    <input type="radio" name="variant" value={v.name} className="sr-only" checked={variant === v.name} onChange={() => setVariant(v.name)} />
                    {v.name}{v.priceDelta ? ` (${v.priceDelta > 0 ? '+' : '−'}${money(Math.abs(v.priceDelta))})` : ''}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!soldOut && <QtyStepper value={qty} onChange={setQty} max={Math.min(10, product.stock)} />}
            <button type="button" className="btn-accent flex-1 py-3 sm:flex-none sm:px-8" onClick={addToCart} disabled={soldOut || adding}>
              {adding ? <Spinner className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}{soldOut ? 'Out of stock' : 'Add to cart'}
            </button>
            <button type="button" className="btn-outline p-3" onClick={() => toggleWishlist(product._id)} aria-pressed={saved} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}>
              <Heart className={`h-5 w-5 ${saved ? 'fill-rose text-rose' : ''}`} />
            </button>
          </div>
          {!user && <p className="mt-3 text-sm text-muted"><Link to={`/login?next=/product/${product.slug}`} className="link">Log in</Link> to add gifts to your cart.</p>}

          <div className="mt-8 space-y-3 rounded-card bg-surface p-5 text-sm">
            <p className="flex gap-3"><Truck className="h-5 w-5 shrink-0 text-sage-ink" aria-hidden="true" />Delivered in 3 to 7 days. Choose a delivery date at checkout.</p>
            <p className="flex gap-3"><PackageCheck className="h-5 w-5 shrink-0 text-sage-ink" aria-hidden="true" />Add gift wrap and a handwritten message for {money(49)}.</p>
          </div>

          <p className="mt-8 max-w-prose leading-relaxed text-ink/90">{product.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {product.occasions.map((o) => <Link key={o} to={`/shop?occasion=${encodeURIComponent(o)}`} className="chip-lavender py-1">{o}</Link>)}
            {product.recipients.map((r) => <Link key={r} to={`/shop?recipient=${encodeURIComponent(r)}`} className="chip-sage py-1">{r}</Link>)}
          </div>
        </div>
      </div>

      <Reviews product={product} detail={data} onChanged={reload} />

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-3xl">You might also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
