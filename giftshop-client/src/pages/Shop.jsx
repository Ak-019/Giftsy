import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, SearchX, X } from 'lucide-react';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import { ProductGrid } from '../components/ProductCard';
import { EmptyState, ErrorState, Pagination } from '../components/ui';
import CollectionHeader from '../components/CollectionHeader';
import { plural } from '../utils/format';

const SORTS = [
  ['newest', 'Newest'], ['popular', 'Most popular'], ['rating', 'Top rated'], ['priceAsc', 'Price: low to high'], ['priceDesc', 'Price: high to low'],
];
const LIST_KEYS = ['category', 'occasion', 'recipient'];

function CheckList({ title, options, selected, onToggle }) {
  if (!options?.length) return null;
  return (
    <fieldset className="border-b border-line pb-5">
      <legend className="mb-3 font-display text-lg">{title}</legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} className="h-4 w-4 rounded accent-[#9B4A5F]" />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const meta = useApi('/products/meta');

  // The URL is the single source of truth, so filtered pages can be shared and the back button works
  const query = useMemo(() => Object.fromEntries([...params.entries()].filter(([, v]) => v !== '')), [params]);
  const page = Number(query.page || 1);
  const { data, loading, error, reload } = useApi('/products', { params: { limit: 12, ...query } });
  const listOf = (k) => (query[k] ? query[k].split(',') : []);

  const [price, setPrice] = useState({ min: query.minPrice || '', max: query.maxPrice || '' });
  useEffect(() => { setPrice({ min: query.minPrice || '', max: query.maxPrice || '' }); }, [query.minPrice, query.maxPrice]);

  const recipientList = listOf('recipient');
  useTitle(query.search ? `Results for "${query.search}"`
    : query.occasion ? `${query.occasion} gifts`
      : recipientList.length === 1 ? `Gifts ${recipientList[0].toLowerCase()}` : 'Shop all gifts');

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v === '' || v == null || v === false ? next.delete(k) : next.set(k, v)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };
  const toggle = (key, value) => {
    const list = listOf(key);
    update({ [key]: (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]).join(',') });
  };
  const clearAll = () => setParams(query.search ? { search: query.search } : {});
  const applyPrice = (e) => { e.preventDefault(); update({ minPrice: price.min, maxPrice: price.max }); };

  const activeChips = [
    ...LIST_KEYS.flatMap((k) => listOf(k).map((v) => ({ key: k, value: v, label: v }))),
    ...(query.minPrice || query.maxPrice ? [{ key: 'price', label: `₹${query.minPrice || 0} to ${query.maxPrice ? `₹${query.maxPrice}` : 'any'}` }] : []),
    ...(query.minRating ? [{ key: 'minRating', label: `${query.minRating}+ stars` }] : []),
    ...(query.inStock ? [{ key: 'inStock', label: 'In stock' }] : []),
    ...(query.featured ? [{ key: 'featured', label: 'Our favourites' }] : []),
  ];
  const removeChip = (c) => {
    if (LIST_KEYS.includes(c.key)) toggle(c.key, c.value);
    else if (c.key === 'price') update({ minPrice: '', maxPrice: '' });
    else update({ [c.key]: '' });
  };

  const filters = (
    <div className="space-y-5">
      <CheckList title="Occasion" options={meta.data?.occasions} selected={listOf('occasion')} onToggle={(v) => toggle('occasion', v)} />
      <CheckList title="Who it's for" options={meta.data?.recipients} selected={listOf('recipient')} onToggle={(v) => toggle('recipient', v)} />
      <CheckList title="Category" options={meta.data?.categories} selected={listOf('category')} onToggle={(v) => toggle('category', v)} />
      <form onSubmit={applyPrice} className="border-b border-line pb-5">
        <p className="mb-3 font-display text-lg">Price</p>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="minPrice">Minimum price</label>
          <input id="minPrice" type="number" min="0" inputMode="numeric" placeholder="Min" className="input py-2" value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value })} />
          <span className="text-muted">to</span>
          <label className="sr-only" htmlFor="maxPrice">Maximum price</label>
          <input id="maxPrice" type="number" min="0" inputMode="numeric" placeholder="Max" className="input py-2" value={price.max} onChange={(e) => setPrice({ ...price, max: e.target.value })} />
        </div>
        <button type="submit" className="btn-outline btn-sm mt-3">Apply price</button>
      </form>
      <fieldset className="border-b border-line pb-5">
        <legend className="mb-3 font-display text-lg">Rating</legend>
        {[4, 3].map((r) => (
          <label key={r} className="mb-2 flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="radio" name="rating" checked={query.minRating === String(r)} onChange={() => update({ minRating: r })} className="h-4 w-4 accent-[#9B4A5F]" />
            {r} stars and up
          </label>
        ))}
      </fieldset>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" checked={query.inStock === 'true'} onChange={(e) => update({ inStock: e.target.checked ? 'true' : '' })} className="h-4 w-4 accent-[#9B4A5F]" />
        Only show gifts in stock
      </label>
    </div>
  );

  return (
    <div className="page pt-8">
      {(() => {
        const recipients = listOf('recipient');
        const title = query.search ? `Results for "${query.search}"`
          : query.occasion && !query.occasion.includes(',') ? `${query.occasion} gifts`
            : recipients.length === 1 ? `Gifts ${recipients[0].toLowerCase()}` : 'All gifts';
        // One recipient and no search: show that recipient's colour band
        return recipients.length === 1 && !query.search
          ? <CollectionHeader recipient={recipients[0]} title={title} />
          : <h1 className="text-4xl sm:text-5xl">{title}</h1>;
      })()}
      <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">{filters}</aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-outline btn-sm lg:hidden" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />Filters{activeChips.length ? ` (${activeChips.length})` : ''}
            </button>
            <p className="text-sm text-muted" aria-live="polite">{data ? plural(data.total, 'gift') : ''}</p>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted">Sort by</span>
              <select className="input w-auto py-1.5" value={query.sort || (query.search ? 'relevance' : 'newest')} onChange={(e) => update({ sort: e.target.value })}>
                {query.search && <option value="relevance">Best match</option>}
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {activeChips.map((c) => (
                <button type="button" key={`${c.key}-${c.label}`} onClick={() => removeChip(c)} className="chip-lavender py-1 text-sm" aria-label={`Remove filter ${c.label}`}>
                  {c.label}<X className="h-3.5 w-3.5" />
                </button>
              ))}
              <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={clearAll}>Clear all</button>
            </div>
          )}

          {error ? <ErrorState message={error} onRetry={reload} />
            : !loading && data?.products.length === 0 ? (
              <EmptyState icon={SearchX} title="No gifts match these filters" action={<button type="button" className="btn-primary" onClick={clearAll}>Clear filters</button>}>
                Try removing a filter or searching for something broader, like "mug" or "hamper".
              </EmptyState>
            ) : <ProductGrid products={data?.products || []} loading={loading} count={12} />}

          <Pagination page={page} pages={data?.pages} onChange={(p) => { update({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" className="flex-1 bg-plum/50" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />
          <div className="w-[85%] max-w-sm overflow-y-auto bg-bg p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl">Filters</h2>
              <button type="button" className="btn-ghost p-2" onClick={() => setFiltersOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            {filters}
            <button type="button" className="btn-primary mt-6 w-full" onClick={() => setFiltersOpen(false)}>Show {data ? plural(data.total, 'gift') : 'gifts'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
