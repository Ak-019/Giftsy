import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Gift } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import { ProductGrid } from '../components/ProductCard';
import { EmptyState, ErrorState } from '../components/ui';
import { BUDGETS, OCCASIONS, RECIPIENTS, RECIPIENT_STYLE } from '../utils/constants';

const STEPS = [
  { key: 'recipient', question: 'Who is the gift for?' },
  { key: 'occasion', question: "What's the occasion?" },
  { key: 'budget', question: "What's your budget?" },
  { key: 'interests', question: 'What are they into?', hint: 'Pick any that fit, or skip this one.' },
];

function Option({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center justify-between gap-3 rounded-card border px-5 py-4 text-left font-display text-xl transition-colors ${selected ? 'border-plum bg-plum text-cream dark:border-cream dark:bg-cream dark:text-plum' : 'border-line bg-surface text-ink hover:border-accent'}`}
    >
      {children}
      {selected && <Check className="h-5 w-5 shrink-0" />}
    </button>
  );
}

export default function GiftFinder() {
  useTitle('Gift Finder');
  const [params, setParams] = useSearchParams();
  const meta = useApi('/products/meta');
  const fromUrl = params.get('recipient') || params.get('occasion') || params.get('budgetMax');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ recipient: '', occasion: '', budget: null, interests: [] });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const find = async (a) => {
    setLoading(true);
    setError('');
    try {
      const query = {};
      if (a.recipient) query.recipient = a.recipient;
      if (a.occasion) query.occasion = a.occasion;
      if (a.budget?.min) query.budgetMin = a.budget.min;
      if (a.budget?.max) query.budgetMax = a.budget.max;
      if (a.interests.length) query.interests = a.interests.join(',');
      setParams(query, { replace: true });
      const { data } = await api.get('/products/gift-finder', { params: { ...query, limit: 12 } });
      setResult(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Arriving from the home page sentence (or a reminder) jumps straight to results
  useEffect(() => {
    if (!fromUrl) return;
    const max = Number(params.get('budgetMax')) || null;
    const min = Number(params.get('budgetMin')) || 0;
    const a = {
      recipient: RECIPIENTS.includes(params.get('recipient')) ? params.get('recipient') : '',
      occasion: OCCASIONS.includes(params.get('occasion')) ? params.get('occasion') : '',
      budget: max || min ? { min, max, label: max ? `Under ₹${max.toLocaleString('en-IN')}` : `₹${min}+` } : null,
      interests: (params.get('interests') || '').split(',').filter(Boolean),
    };
    setAnswers(a);
    find(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (key, value) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (key !== 'interests') setStep((s) => s + 1);
  };

  const restart = () => {
    setResult(null);
    setStep(0);
    setAnswers({ recipient: '', occasion: '', budget: null, interests: [] });
    setParams({}, { replace: true });
  };

  if (result || loading || error) {
    const summary = [answers.recipient, answers.occasion, answers.budget?.label, ...answers.interests].filter(Boolean);
    const theme = RECIPIENT_STYLE[answers.recipient];
    return (
      <div className="page pt-10">
        <div className={theme ? 'rounded-card px-6 py-8 sm:px-10' : ''} style={theme ? { background: theme.bg, color: theme.fg } : undefined}>
          <h1 className="text-4xl sm:text-5xl" style={theme ? { color: theme.fg } : undefined}>Gifts we think they'll love</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {summary.map((s) => (
              <span key={s} className={theme ? 'chip py-1 text-sm' : 'chip-lavender py-1 text-sm'}
                style={theme ? { background: theme.accent, color: theme.accent === '#5E3A4D' ? '#F4E1D2' : '#2A1A23' } : undefined}>{s}</span>
            ))}
            <button type="button" className={`ml-2 text-sm font-medium hover:underline ${theme ? '' : 'text-accent'}`} style={theme ? { color: theme.fg } : undefined} onClick={restart}>Change answers</button>
          </div>
        </div>
        {result?.relaxed && (
          <p className="mt-6 rounded-xl bg-lavender/30 px-4 py-3 text-sm">Nothing matched every answer, so these are the closest gifts we have.</p>
        )}
        <div className="mt-8">
          {error ? <ErrorState message={error} onRetry={() => find(answers)} />
            : result && result.products.length === 0 ? (
              <EmptyState icon={Gift} title="No gifts in this budget yet" action={<button type="button" className="btn-primary" onClick={restart}>Try a different budget</button>}>
                Raise the budget or leave out an answer to see more.
              </EmptyState>
            ) : <ProductGrid products={result?.products || []} loading={loading} count={8} reasonsKey="matchReasons" chipClass={theme?.chip} />}
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  const options = {
    recipient: RECIPIENTS.map((r) => ({ value: r, label: r })),
    occasion: OCCASIONS.map((o) => ({ value: o, label: o })),
    budget: BUDGETS.map((b) => ({ value: b, label: b.label })),
    interests: (meta.data?.categories || []).map((c) => ({ value: c, label: c })),
  }[current.key];

  return (
    <div className="page max-w-3xl pt-10">
      <h1 className="text-4xl sm:text-5xl">Gift Finder</h1>
      <ol className="mt-6 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex-1">
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className={`h-1.5 w-full rounded-full ${i <= step ? 'bg-rose' : 'bg-line'}`}
              aria-label={`Step ${i + 1}: ${s.question}`}
              aria-current={i === step ? 'step' : undefined}
            />
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-muted">Step {step + 1} of {STEPS.length}</p>
      <h2 className="mt-1 text-3xl">{current.question}</h2>
      {current.hint && <p className="mt-1 text-muted">{current.hint}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const selected = current.key === 'interests'
            ? answers.interests.includes(o.value)
            : current.key === 'budget' ? answers.budget?.label === o.label : answers[current.key] === o.value;
          return (
            <Option
              key={o.label}
              selected={selected}
              onClick={() => (current.key === 'interests'
                ? choose('interests', selected ? answers.interests.filter((x) => x !== o.value) : [...answers.interests, o.value])
                : choose(current.key, o.value))}
            >{o.label}</Option>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        {step > 0 ? <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>Back</button> : <Link to="/shop" className="btn-ghost">Just browse instead</Link>}
        {current.key === 'interests'
          ? <button type="button" className="btn-primary px-7" onClick={() => find(answers)}>{answers.interests.length ? 'Show my gifts' : 'Skip and show gifts'}</button>
          : <button type="button" className="btn-ghost" onClick={() => setStep(step + 1)}>Skip this question</button>}
      </div>
    </div>
  );
}
