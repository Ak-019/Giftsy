import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { errorMessage, fieldErrors } from '../api/client';
import { Field, Spinner } from '../components/ui';
import useTitle from '../hooks/useTitle';
import { safeRedirect } from '../utils/format';

export default function Login() {
  useTitle('Log in');
  const { login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = safeRedirect(params.get('next'));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(user.role === 'admin' && !params.get('next') ? '/admin' : next, { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Log in" footer={<>New here? <Link className="link" to={`/register${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <Field label="Email" id="email" error={errors.email}>
          <input id="email" type="email" className="input" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" id="password" error={errors.password}>
          <input id="password" type="password" className="input" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Log in</button>
      </form>
    </AuthCard>
  );
}

export function AuthCard({ title, children, footer }) {
  return (
    <div className="page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-5xl">{title}</h1>
        <div className="card p-6 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}
