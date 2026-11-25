import { useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors } from '../../api/client';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { ConfirmDialog, ErrorState, Field, Modal, Spinner } from '../../components/ui';
import { date, isoDay, money } from '../../utils/format';
import { AdminTitle, Table } from './AdminLayout';

const EMPTY = { code: '', description: '', type: 'percent', value: '', minOrder: '0', maxDiscount: '', expiresAt: '', usageLimit: '', onePerUser: true, isActive: true };

function CouponForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial?._id ? {
    ...EMPTY, ...initial, value: String(initial.value), minOrder: String(initial.minOrder ?? 0),
    maxDiscount: initial.maxDiscount != null ? String(initial.maxDiscount) : '', usageLimit: initial.usageLimit != null ? String(initial.usageLimit) : '',
    expiresAt: isoDay(initial.expiresAt),
  } : EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (!/^[A-Za-z0-9]{3,20}$/.test(form.code)) local.code = '3 to 20 letters or digits';
    if (!(Number(form.value) > 0)) local.value = 'Enter a value above 0';
    if (form.type === 'percent' && Number(form.value) > 100) local.value = 'Percent must be 100 or less';
    if (!form.expiresAt) local.expiresAt = 'Choose an end date';
    setErrors(local);
    if (Object.keys(local).length) return;
    const body = {
      code: form.code.toUpperCase(), description: form.description.trim(), type: form.type, value: Number(form.value),
      minOrder: Number(form.minOrder) || 0, maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      expiresAt: `${form.expiresAt}T23:59:59`, usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      onePerUser: form.onePerUser, isActive: form.isActive,
    };
    setBusy(true);
    try {
      if (initial?._id) await api.put(`/admin/coupons/${initial._id}`, body);
      else await api.post('/admin/coupons', body);
      toast.success('Coupon saved');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally { setBusy(false); }
  };

  const input = (k, label, props = {}) => (
    <Field label={label} id={`c-${k}`} error={errors[k]}><input id={`c-${k}`} className="input" value={form[k]} onChange={set(k)} {...props} /></Field>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {input('code', 'Code', { maxLength: 20, className: 'input uppercase' })}
      <Field label="Type" id="c-type"><select id="c-type" className="input" value={form.type} onChange={set('type')}><option value="percent">Percent off</option><option value="flat">Fixed amount off</option></select></Field>
      {input('value', form.type === 'percent' ? 'Percent off' : 'Amount off (₹)', { type: 'number', min: 1 })}
      {input('minOrder', 'Minimum order (₹)', { type: 'number', min: 0 })}
      {form.type === 'percent' && input('maxDiscount', 'Maximum discount (₹, optional)', { type: 'number', min: 1 })}
      {input('usageLimit', 'Total uses allowed (optional)', { type: 'number', min: 1 })}
      {input('expiresAt', 'Valid until', { type: 'date' })}
      <div className="sm:col-span-2">{input('description', 'Description shown to customers', { maxLength: 200, placeholder: '10% off your order' })}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.onePerUser} onChange={set('onePerUser')} className="h-4 w-4 accent-[#9B4A5F]" />Once per customer</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} className="h-4 w-4 accent-[#9B4A5F]" />Active</label>
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save coupon</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Coupons() {
  useTitle('Coupons');
  const { data, loading, error, reload } = useApi('/admin/coupons');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const now = new Date();

  const state = (c) => {
    if (!c.isActive) return ['Off', 'chip-muted'];
    if (new Date(c.expiresAt) < now) return ['Expired', 'chip-muted'];
    if (c.usageLimit != null && c.usedCount >= c.usageLimit) return ['Used up', 'chip-muted'];
    return ['Live', 'chip-sage'];
  };

  return (
    <div>
      <AdminTitle title="Coupons"><button type="button" className="btn-primary btn-sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" />New coupon</button></AdminTitle>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <Table head={['Code', 'Discount', 'Minimum', 'Used', 'Valid until', 'State', '']} empty={!loading && data?.coupons.length === 0 ? 'No coupons yet' : null}>
          {(data?.coupons || []).map((c) => {
            const [label, chip] = state(c);
            return (
              <tr key={c._id}>
                <td className="px-4 py-3 font-semibold">{c.code}<span className="block text-xs font-normal text-muted">{c.description}</span></td>
                <td className="px-4 py-3">{c.type === 'percent' ? `${c.value}%${c.maxDiscount ? `, up to ${money(c.maxDiscount)}` : ''}` : money(c.value)}</td>
                <td className="px-4 py-3">{c.minOrder ? money(c.minOrder) : 'None'}</td>
                <td className="px-4 py-3">{c.usedCount}{c.usageLimit != null ? ` of ${c.usageLimit}` : ''}</td>
                <td className="px-4 py-3">{date(c.expiresAt)}</td>
                <td className="px-4 py-3"><span className={chip}>{label}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button type="button" className="link mr-3 text-xs" onClick={() => setEditing(c)}>Edit</button>
                  <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => setDeleting(c)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.code}` : 'New coupon'} wide>
        {editing && <CouponForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      </Modal>
      <ConfirmDialog open={Boolean(deleting)} title={`Delete ${deleting?.code}?`} message="Customers won't be able to use it any more. Past orders are not affected." confirmLabel="Delete coupon" danger onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try { await api.delete(`/admin/coupons/${deleting._id}`); toast.success('Coupon deleted'); reload(); } catch (err) { toast.error(errorMessage(err)); }
          setDeleting(null);
        }} />
    </div>
  );
}
