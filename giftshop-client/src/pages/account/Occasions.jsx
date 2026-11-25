import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors } from '../../api/client';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { ConfirmDialog, EmptyState, ErrorState, Field, Modal, Skeleton, Spinner } from '../../components/ui';
import { OCCASIONS, OCCASION_STYLE } from '../../utils/constants';
import { date, isoDay, plural } from '../../utils/format';

const EMPTY = { title: '', type: 'Birthday', personName: '', date: '', recurring: true, note: '' };

function OccasionForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial, date: initial?.date ? isoDay(initial.date) : '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (form.title.trim().length < 2) local.title = 'Give it a name, like "Mom\'s birthday"';
    if (!form.date) local.date = 'Choose the date';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const body = { title: form.title.trim(), type: form.type, date: form.date, recurring: form.recurring };
      if (form.personName.trim()) body.personName = form.personName.trim();
      if (form.note.trim()) body.note = form.note.trim();
      if (initial?._id) await api.put(`/account/occasions/${initial._id}`, body);
      else await api.post('/account/occasions', body);
      toast.success('Reminder saved');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="What is it?" id="o-title" error={errors.title}><input id="o-title" className="input" maxLength={80} value={form.title} onChange={set('title')} placeholder="Mom's birthday" /></Field>
      <Field label="Occasion" id="o-type"><select id="o-type" className="input" value={form.type} onChange={set('type')}>{OCCASIONS.map((o) => <option key={o}>{o}</option>)}</select></Field>
      <Field label="Date" id="o-date" error={errors.date}><input id="o-date" type="date" className="input" value={form.date} onChange={set('date')} /></Field>
      <Field label="Whose is it? (optional)" id="o-person"><input id="o-person" className="input" maxLength={60} value={form.personName} onChange={set('personName')} placeholder="Mom" /></Field>
      <div className="sm:col-span-2"><Field label="Note (optional)" id="o-note"><input id="o-note" className="input" maxLength={200} value={form.note} onChange={set('note')} placeholder="Loves lavender candles" /></Field></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={form.recurring} onChange={set('recurring')} className="h-4 w-4 accent-[#9B4A5F]" />Repeats every year
      </label>
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save reminder</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Occasions() {
  useTitle('Reminders');
  const all = useApi('/account/occasions');
  const upcoming = useApi('/account/occasions/upcoming', { params: { days: 366 } });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const reload = () => { all.reload(); upcoming.reload(); };
  if (all.error) return <ErrorState message={all.error} onRetry={reload} />;
  if (all.loading && !all.data) return <Skeleton className="h-40 w-full" />;

  // Show reminders in the order they come up next
  const list = upcoming.data?.occasions || [];
  const pastOneOffs = (all.data?.occasions || []).filter((o) => !list.some((u) => u._id === o._id));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-3xl">Birthday and anniversary reminders</h2>
        {list.length + pastOneOffs.length > 0 && <button type="button" className="btn-primary btn-sm shrink-0" onClick={() => setEditing({})}>Add reminder</button>}
      </div>
      <p className="mb-6 text-muted">We'll show what's coming up on your home page, with gift ideas for each one.</p>

      {list.length + pastOneOffs.length === 0 ? (
        <EmptyState icon={CalendarHeart} title="No reminders yet" action={<button type="button" className="btn-primary" onClick={() => setEditing({})}>Add your first reminder</button>}>
          Add birthdays and anniversaries so you never scramble for a gift again.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {[...list, ...pastOneOffs].map((o) => {
            const style = OCCASION_STYLE[o.type] || OCCASION_STYLE.Other;
            return (
              <li key={o._id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-center" style={{ background: style.bg, color: style.fg }}>
                  {o.nextDate ? (<><span className="font-display text-xl leading-none">{new Date(o.nextDate).getUTCDate()}</span><span className="text-[11px] font-semibold">{new Date(o.nextDate).toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' })}</span></>) : <span className="text-xs">Past</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{o.title}</p>
                  <p className="text-sm text-muted">
                    {o.type}{o.personName ? ` for ${o.personName}` : ''}, {o.daysLeft === undefined ? date(o.date) : o.daysLeft === 0 ? 'today' : `in ${plural(o.daysLeft, 'day')}`}
                    {o.note ? `. ${o.note}` : ''}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  {o.daysLeft !== undefined && o.daysLeft <= 30 && <Link to={`/gift-finder?occasion=${encodeURIComponent(o.type)}`} className="btn-accent btn-sm">Find a gift</Link>}
                  <button type="button" className="link" onClick={() => setEditing(o)}>Edit</button>
                  <button type="button" className="text-muted hover:text-danger" onClick={() => setDeleting(o)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? 'Edit reminder' : 'Add a reminder'} wide>
        {editing && <OccasionForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} title="Delete this reminder?" message={deleting?.title} confirmLabel="Delete reminder" danger onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try { await api.delete(`/account/occasions/${deleting._id}`); toast.success('Reminder deleted'); reload(); } catch (err) { toast.error(errorMessage(err)); }
          setDeleting(null);
        }} />
    </div>
  );
}
