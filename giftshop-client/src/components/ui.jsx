import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Star, X } from 'lucide-react';
import { money, discountPercent } from '../utils/format';

export const Spinner = ({ className = 'h-5 w-5' }) => <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted" role="status">
      <Spinner className="h-7 w-7" /><span className="sr-only">Loading</span>
    </div>
  );
}

export const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && <Icon className="mb-4 h-10 w-10 text-rose" strokeWidth={1.5} aria-hidden="true" />}
      <h2 className="text-2xl">{title}</h2>
      {children && <p className="mt-2 max-w-md text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card my-6 flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <p className="text-ink">{message}</p>
      {onRetry && <button type="button" className="btn-outline btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-plum/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-card bg-surface p-6 shadow-xl outline-none sm:rounded-card ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-2xl">{title}</h2>
          <button type="button" className="btn-ghost -mr-2 -mt-1 p-2" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, busy, onConfirm, onClose, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {message && <p className="text-muted">{message}</p>}
      {children}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="btn-ghost" onClick={onClose}>Keep it</button>
        <button type="button" className={danger ? 'btn-destructive' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}{confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <nav className="mt-10 flex items-center justify-center gap-1" aria-label="Pages">
      <button type="button" className="btn-ghost p-2" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
      {nums.map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => onChange(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`h-9 min-w-9 rounded-full px-3 text-sm ${n === page ? 'bg-brand text-brand-ink' : 'hover:bg-ink/5'}`}
        >{n}</button>
      ))}
      <button type="button" className="btn-ghost p-2" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
    </nav>
  );
}

export function Stars({ value = 0, size = 'h-4 w-4', label = true }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label ? `${value} out of 5 stars` : undefined} role={label ? 'img' : undefined}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden="true" className={`${size} ${i <= Math.round(value) ? 'fill-rose text-rose' : 'text-ink/25'}`} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          type="button"
          key={i}
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onClick={() => onChange(i)}
          className="rounded p-0.5"
        >
          <Star className={`h-7 w-7 ${i <= value ? 'fill-rose text-rose' : 'text-ink/30'}`} />
        </button>
      ))}
    </div>
  );
}

export function Field({ label, error, hint, children, id }) {
  return (
    <div>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function QtyStepper({ value, onChange, min = 1, max = 10, disabled }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface">
      <button type="button" className="p-2 disabled:opacity-40" onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
      <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{value}</span>
      <button type="button" className="p-2 disabled:opacity-40" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

export function Price({ price, finalPrice, large = false }) {
  const off = discountPercent(price, finalPrice ?? price);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className={`font-display font-semibold text-ink ${large ? 'text-3xl' : 'text-base'}`}>{money(finalPrice ?? price)}</span>
      {off > 0 && (
        <>
          <span className="text-sm text-muted line-through">{money(price)}</span>
          <span className="text-sm font-semibold text-accent">{off}% off</span>
        </>
      )}
    </span>
  );
}

export function StockNote({ stock }) {
  if (stock <= 0) return <span className="chip-muted">Out of stock</span>;
  if (stock <= 5) return <span className="chip-rose">Only {stock} left</span>;
  return <span className="chip-sage">In stock</span>;
}

export function SectionHeading({ title, to, linkText = 'See all' }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      {to && <Link to={to} className="link shrink-0 text-sm">{linkText}</Link>}
    </div>
  );
}
