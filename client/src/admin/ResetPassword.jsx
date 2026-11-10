import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { Field } from '../components/ui';
import AuthShell from './AuthShell';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      const r = await api('/auth/reset-password', { method: 'POST', body: { token, password: form.password } });
      setMsg(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Choose a New Password" subtitle="At least 8 characters, including a letter and a number.">
      {!token ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">This reset link is missing its token. Please request a new one.</p>
      ) : msg ? (
        <div className="space-y-4">
          <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700">{msg}</p>
          <Link to="/admin/login" className="btn-primary w-full">Go to login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password">
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="Confirm password">
            <input className="input" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" required />
          </Field>
          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full py-3" disabled={busy}>
            <KeyRound className="h-4 w-4" /> {busy ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
