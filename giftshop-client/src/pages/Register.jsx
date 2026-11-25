import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { errorMessage, fieldErrors } from '../api/client';
import { Field, Spinner } from '../components/ui';
import useTitle from '../hooks/useTitle';
import { safeRedirect } from '../utils/format';
import { AuthCard } from './Login';

export default function Register() {
  useTitle('Create an account');
  const { register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (form.name.trim().length < 2) local.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) local.email = 'Enter a valid email';
    if (form.password.length < 6) local.password = 'Use at least 6 characters';
    setErrors(local);
    setError('');
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await register(form);
      toast.success('Your account is ready');
      navigate(safeRedirect(params.get('next')), { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthCard title="Create an account" footer={<>Already have an account? <Link className="link" to="/login">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <Field label="Your name" id="name" error={errors.name}>
          <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" id="email" error={errors.email}>
          <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" id="password" error={errors.password} hint="At least 6 characters">
          <input id="password" type="password" className="input" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Create account</button>
      </form>
    </AuthCard>
  );
}
