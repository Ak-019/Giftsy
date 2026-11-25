import { RECIPIENT_STYLE } from '../utils/constants';
import { plural } from '../utils/format';

// A colour band at the top of a recipient's collection, e.g. Plum with Sage stripes for "For Him"
export default function CollectionHeader({ recipient, title, count }) {
  const style = RECIPIENT_STYLE[recipient];
  if (!style) return <h1 className="text-4xl sm:text-5xl">{title}</h1>;
  return (
    <div className="relative overflow-hidden rounded-card px-6 py-8 sm:px-10 sm:py-10" style={{ background: style.bg, color: style.fg }}>
      {/* three stripes in the accent colour, echoing the stacked palette bands on the home page */}
      <div aria-hidden="true" className="absolute -right-6 top-0 flex h-full rotate-12 gap-3 opacity-70">
        {[0, 1, 2].map((i) => <span key={i} className="block h-full w-6 rounded-full" style={{ background: style.accent, opacity: 1 - i * 0.25 }} />)}
      </div>
      <div className="relative max-w-xl">
        <h1 className="text-4xl sm:text-5xl" style={{ color: style.fg }}>{title}</h1>
        <p className="mt-2 text-base opacity-90">{style.line}</p>
        {count != null && <p className="mt-4 text-sm font-semibold opacity-80">{plural(count, 'gift')}</p>}
      </div>
    </div>
  );
}
