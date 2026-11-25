import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import api, { imageUrl } from '../api/client';
import useDebounce from '../hooks/useDebounce';
import { money } from '../utils/format';

// Debounced search with a suggestions dropdown (keyboard: up/down to move, Enter to open, Esc to close)
export default function SearchBox({ className = '', onDone }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebounce(q.trim(), 250);
  const navigate = useNavigate();
  const listId = useId();
  const boxRef = useRef(null);

  useEffect(() => {
    if (!debounced) { setItems([]); return undefined; }
    let cancelled = false;
    api.get('/products/suggest', { params: { q: debounced } })
      .then((res) => { if (!cancelled) { setItems(res.data.products); setActive(-1); } })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [debounced]);

  useEffect(() => {
    const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (path) => {
    setOpen(false);
    setQ('');
    onDone?.();
    navigate(path);
  };

  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && items[active]) return go(`/product/${items[active].slug}`);
    if (q.trim()) return go(`/shop?search=${encodeURIComponent(q.trim())}`);
    return undefined;
  };

  const onKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    if (e.key === 'Escape') setOpen(false);
  };

  const showList = open && q.trim() && items.length > 0;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={submit} role="search">
        <label htmlFor={`${listId}-input`} className="sr-only">Search gifts</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id={`${listId}-input`}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search mugs, hampers, candles..."
          className="input rounded-full py-2 pl-10"
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          maxLength={100}
        />
      </form>
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-40 mt-2 w-full overflow-hidden rounded-card border border-line bg-surface py-1 shadow-lg">
          {items.map((p, i) => (
            <li key={p._id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(`/product/${p.slug}`)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-ink/5' : 'hover:bg-ink/5'}`}
              >
                <img src={imageUrl(p.images?.[0])} alt="" className="h-9 w-9 rounded-md object-cover" />
                <span className="flex-1 text-ink">{p.name}</span>
                <span className="text-muted">{money(p.finalPrice)}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/shop?search=${encodeURIComponent(q.trim())}`)} className="w-full px-3 py-2 text-left text-sm font-medium text-accent hover:bg-ink/5">
              See all results for "{q.trim()}"
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
