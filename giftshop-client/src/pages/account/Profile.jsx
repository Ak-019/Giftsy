import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errorMessage, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Field, Spinner } from '../../components/ui';
import useTitle from '../../hooks/useTitle';

export default function Profile() {
  useTitle('Profile');
  const { user, setUser, startSession, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    setErrors({});
    try {
      const body = { name: profile.name };
      if (profile.phone) body.phone = profile.phone;
      const { data } = await api.put('/account/profile', body);
      setUser((u) => ({ ...u, ...data.user }));
      toast.success('Profile saved');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally { setBusy(''); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) { setErrors({ confirm: "The new passwords don't match" }); return; }
    setBusy('pw');
    setErrors({});
    try {
      const { data } = await api.put('/account/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      startSession(data);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed. Other devices were logged out.');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally { setBusy(''); }
  };

  const logoutEverywhere = async () => {
    setBusy('all');
    try {
      await api.post('/auth/logout-all');
      await logout();
      toast.success('Logged out on all devices');
      navigate('/login');
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy('');
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={saveProfile} className="card space-y-4 p-6">
        <h2 className="text-2xl">Your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" id="p-name" error={errors.name}><input id="p-name" className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
          <Field label="Mobile number" id="p-phone" error={errors.phone}><input id="p-phone" className="input" inputMode="numeric" maxLength={10} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
          <Field label="Email" id="p-email" hint="Email can't be changed"><input id="p-email" className="input opacity-70" value={user.email} disabled /></Field>
        </div>
        <button type="submit" className="btn-primary" disabled={busy === 'profile'}>{busy === 'profile' && <Spinner className="h-4 w-4" />}Save details</button>
      </form>

      <form onSubmit={changePassword} className="card space-y-4 p-6">
        <h2 className="text-2xl">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" id="pw-c" error={errors.currentPassword}><input id="pw-c" type="password" autoComplete="current-password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></Field>
          <Field label="New password" id="pw-n" error={errors.newPassword}><input id="pw-n" type="password" autoComplete="new-password" minLength={6} className="input" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></Field>
          <Field label="Repeat new password" id="pw-r" error={errors.confirm}><input id="pw-r" type="password" autoComplete="new-password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
        </div>
        <button type="submit" className="btn-primary" disabled={busy === 'pw'}>{busy === 'pw' && <Spinner className="h-4 w-4" />}Change password</button>
      </form>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-2xl">Log out everywhere</h2>
          <p className="text-sm text-muted">Use this if you logged in on a shared or lost device.</p>
        </div>
        <button type="button" className="btn-danger" onClick={logoutEverywhere} disabled={busy === 'all'}>{busy === 'all' && <Spinner className="h-4 w-4" />}Log out on all devices</button>
      </div>
    </div>
  );
}
