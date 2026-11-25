import { useState } from 'react';
import { Field, Spinner } from './ui';

const EMPTY = { label: '', fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

// Checks the same rules as the API so most mistakes show before submitting
export function validateAddress(a) {
  const e = {};
  if (!a.fullName || a.fullName.trim().length < 2) e.fullName = 'Enter the full name';
  if (!/^[6-9]\d{9}$/.test(a.phone || '')) e.phone = 'Enter a 10-digit mobile number';
  if (!a.line1 || a.line1.trim().length < 3) e.line1 = 'Enter the house number and street';
  if (!a.city || a.city.trim().length < 2) e.city = 'Enter the city';
  if (!a.state || a.state.trim().length < 2) e.state = 'Enter the state';
  if (!/^\d{6}$/.test(a.pincode || '')) e.pincode = 'Enter a 6-digit pincode';
  return e;
}

export default function AddressForm({ initial, onSubmit, onCancel, submitLabel = 'Save address', showLabel = true, showDefault = false, serverErrors = {} }) {
  const [form, setForm] = useState({ ...EMPTY, isDefault: false, ...initial });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const allErrors = { ...serverErrors, ...errors };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validateAddress(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { _id, ...body } = form;
      if (!showLabel) delete body.label;
      if (!showDefault) delete body.isDefault;
      if (!body.label) delete body.label;
      await onSubmit(body);
    } finally {
      setBusy(false);
    }
  };

  const input = (k, label, props = {}) => (
    <Field label={label} error={allErrors[k]} id={`addr-${k}`}>
      <input id={`addr-${k}`} className="input" value={form[k] || ''} onChange={set(k)} aria-invalid={Boolean(allErrors[k])} {...props} />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {showLabel && <div className="sm:col-span-2">{input('label', 'Label', { placeholder: "Home, Office, Mom's place", maxLength: 30 })}</div>}
      {input('fullName', 'Full name', { autoComplete: 'name' })}
      {input('phone', 'Mobile number', { inputMode: 'numeric', autoComplete: 'tel-national', maxLength: 10 })}
      <div className="sm:col-span-2">{input('line1', 'House number and street', { autoComplete: 'address-line1' })}</div>
      <div className="sm:col-span-2">{input('line2', 'Area or landmark (optional)', { autoComplete: 'address-line2' })}</div>
      {input('city', 'City', { autoComplete: 'address-level2' })}
      {input('state', 'State', { autoComplete: 'address-level1' })}
      {input('pincode', 'Pincode', { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 6 })}
      {showDefault && (
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" checked={Boolean(form.isDefault)} onChange={set('isDefault')} className="h-4 w-4 accent-[#9B4A5F]" />
          Make this my default address
        </label>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{submitLabel}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
