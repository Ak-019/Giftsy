import { Check, X } from 'lucide-react';
import { ORDER_FLOW } from '../utils/constants';
import { dateTime } from '../utils/format';

// Placed -> Packed -> Shipped -> Delivered, with the time each step happened
export default function StatusTimeline({ order }) {
  const when = Object.fromEntries((order.statusHistory || []).map((h) => [h.status, h.at]));
  const cancelled = order.status === 'Cancelled';
  const steps = cancelled
    ? [...ORDER_FLOW.filter((s) => when[s]), 'Cancelled']
    : ORDER_FLOW;
  const currentIndex = steps.indexOf(order.status);

  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-start">
      {steps.map((step, i) => {
        const done = i <= currentIndex;
        const isCancel = step === 'Cancelled';
        return (
          <li key={step} className="relative flex flex-1 gap-3 pb-6 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
            {i < steps.length - 1 && (
              <span aria-hidden="true" className={`absolute left-[13px] top-7 h-[calc(100%-28px)] w-0.5 sm:left-[calc(50%+14px)] sm:top-[13px] sm:h-0.5 sm:w-[calc(100%-28px)] ${i < currentIndex ? 'bg-sage' : 'bg-line'}`} />
            )}
            <span className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
              isCancel ? 'border-accent bg-accent text-white' : done ? 'border-sage bg-sage text-plum' : 'border-line bg-surface text-muted'}`}
            >
              {isCancel ? <X className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <div className="sm:mt-2">
              <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-muted'}`}>{step}</p>
              {when[step] && <p className="text-xs text-muted">{dateTime(when[step])}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
