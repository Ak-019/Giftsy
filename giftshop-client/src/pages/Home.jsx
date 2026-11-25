import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import { useAuth } from '../context/AuthContext';
import { ProductGrid } from '../components/ProductCard';
import { SectionHeading } from '../components/ui';
import { BUDGETS, OCCASIONS, OCCASION_STYLE, RECIPIENTS, RECIPIENT_STYLE } from '../utils/constants';
import { plural } from '../utils/format';

const WHO = [
  ['For Her', 'her'], ['For Him', 'him'], ['Parents', 'my parents'], ['Kids', 'a child'],
  ['Couples', 'a couple'], ['Friends', 'a friend'], ['Colleagues', 'a colleague'],
];
const HERO_BUDGETS = [500, 1000, 2000, 5000];
const HERO_BANDS = ['Birthday', 'Anniversary', 'Wedding', 'Festival', 'Housewarming'];

// The hero is a sentence the visitor completes; it sends them straight to matching gifts
function GiftSentence() {
  const [who, setWho] = useState('For Her');
  const [occasion, setOccasion] = useState('Birthday');
  const [budget, setBudget] = useState(1000);
  const navigate = useNavigate();

  const select = 'sentence-select mx-1 inline-block cursor-pointer appearance-none border-0 border-b-2 border-rose bg-transparent px-1 py-0 font-display text-accent focus:outline-none focus:ring-0';
  const submit = (e) => {
    e.preventDefault();
    navigate(`/gift-finder?recipient=${encodeURIComponent(who)}&occasion=${encodeURIComponent(occasion)}&budgetMax=${budget}`);
  };

  return (
    <form onSubmit={submit} className="mt-8">
      <p className="font-display text-2xl leading-[1.6] text-ink sm:text-[1.75rem]">
        I'm looking for a gift for
        <label className="sr-only" htmlFor="hero-who">Who is it for</label>
        <select id="hero-who" className={select} value={who} onChange={(e) => setWho(e.target.value)}>
          {WHO.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
        for a
        <label className="sr-only" htmlFor="hero-occasion">Occasion</label>
        <select id="hero-occasion" className={select} value={occasion} onChange={(e) => setOccasion(e.target.value)}>
          {OCCASIONS.filter((o) => o !== 'Other').map((o) => <option key={o} value={o}>{o.toLowerCase()}</option>)}
        </select>
        under
        <label className="sr-only" htmlFor="hero-budget">Budget</label>
        <select id="hero-budget" className={select} value={budget} onChange={(e) => setBudget(Number(e.target.value))}>
          {HERO_BUDGETS.map((b) => <option key={b} value={b}>₹{b.toLocaleString('en-IN')}</option>)}
        </select>
      </p>
      <button type="submit" className="btn-primary mt-6 px-7 py-3 text-base">Show me gifts</button>
    </form>
  );
}

function UpcomingOccasions() {
  const { user } = useAuth();
  const { data } = useApi(user ? '/account/occasions/upcoming' : null, { params: { days: 30 } });
  const list = data?.occasions || [];
  if (!list.length) return null;
  return (
    <section className="page mt-10" aria-label="Upcoming occasions">
      <div className="flex flex-col gap-3 rounded-card bg-lavender/35 p-5 sm:flex-row sm:items-center sm:gap-6">
        <Bell className="h-6 w-6 shrink-0 text-lavender-ink" aria-hidden="true" />
        <ul className="flex-1 space-y-1">
          {list.slice(0, 3).map((o) => (
            <li key={o._id} className="text-ink">
              <span className="font-semibold">{o.title}</span>{' '}
              {o.daysLeft === 0 ? 'is today' : `is in ${plural(o.daysLeft, 'day')}`}.{' '}
              <Link className="link" to={`/gift-finder?occasion=${encodeURIComponent(o.type)}`}>Find a gift</Link>
            </li>
          ))}
        </ul>
        <Link to="/account/occasions" className="btn-outline btn-sm self-start sm:self-center">Manage reminders</Link>
      </div>
    </section>
  );
}

export default function Home() {
  useTitle('');
  const featured = useApi('/products', { params: { featured: 'true', limit: 4, inStock: 'true' } });
  const trending = useApi('/products', { params: { sort: 'popular', limit: 4, inStock: 'true' } });

  return (
    <>
      <section className="page grid items-center gap-10 pt-10 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl">Gifts that feel like they were chosen, not bought.</h1>
          <GiftSentence />
        </div>
        {/* Occasion swatches, a nod to the palette card the colours came from */}
        <nav aria-label="Shop by occasion" className="flex flex-col gap-2.5">
          {HERO_BANDS.map((o, i) => (
            <Link
              key={o}
              to={`/shop?occasion=${encodeURIComponent(o)}`}
              style={{ background: OCCASION_STYLE[o].bg, color: OCCASION_STYLE[o].fg, marginLeft: `${(i % 2) * 6}%` }}
              className={`group flex items-end justify-between rounded-md px-6 py-4 ring-inset transition-transform hover:translate-x-1 dark:ring-1 dark:ring-cream/25 ${o === 'Wedding' ? 'ring-1 ring-plum/15' : ''}`}
            >
              <span className="font-display text-3xl font-light sm:text-4xl">{o}</span>
              <span className="text-xs font-semibold opacity-80 group-hover:opacity-100">Shop gifts</span>
            </Link>
          ))}
        </nav>
      </section>

      <UpcomingOccasions />

      <section className="page mt-20">
        <SectionHeading title="Our favourites right now" to="/shop?featured=true" />
        <ProductGrid products={featured.data?.products || []} loading={featured.loading} count={4} />
      </section>

      <section className="mt-20 bg-surface py-14">
        <div className="page">
          <h2 className="text-3xl sm:text-4xl">Shop by budget</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {BUDGETS.map((b) => (
              <Link
                key={b.label}
                to={`/shop?minPrice=${b.min}${b.max ? `&maxPrice=${b.max}` : ''}&sort=priceAsc`}
                className="rounded-card border border-line bg-bg px-5 py-6 font-display text-xl text-ink transition-colors hover:border-accent sm:text-2xl"
              >
                {b.label}
              </Link>
            ))}
          </div>
          <h2 className="mt-14 text-3xl sm:text-4xl">Who are you shopping for?</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {RECIPIENTS.map((r) => (
              <Link key={r} to={`/shop?recipient=${encodeURIComponent(r)}`} className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: RECIPIENT_STYLE[r]?.bg }} />{r}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="page mt-20">
        <SectionHeading title="What everyone's sending" to="/shop?sort=popular" />
        <ProductGrid products={trending.data?.products || []} loading={trending.loading} count={4} />
      </section>

      <section className="page mt-20">
        <div className="grid items-center gap-6 rounded-card bg-plum px-8 py-10 text-cream sm:grid-cols-[1fr_auto] sm:px-12">
          <div>
            <h2 className="text-3xl text-cream sm:text-4xl">Not sure what to get?</h2>
            <p className="mt-2 max-w-lg text-cream/85">Answer four quick questions and we'll pick gifts that match who it's for, the occasion and your budget.</p>
          </div>
          <Link to="/gift-finder" className="btn bg-cream px-7 py-3 text-base text-plum hover:bg-white">Start the Gift Finder</Link>
        </div>
      </section>
    </>
  );
}
