import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';
import { PageHeader } from './ui';

export default function Account() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) return toast.error('New passwords do not match');
    setBusy(true);
    try {
      const r = await api('/auth/change-password', { method: 'POST', body: { current_password: form.current_password, new_password: form.new_password } });
      toast.success(r.message);
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <PageHeader title="My Account" subtitle={`${user.name} · ${user.email} · @${user.username}`} />
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h2 className="font-semibold text-navy-800">Change Password</h2>
        <Field label="Current password">
          <input type="password" className="input" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} autoComplete="current-password" required />
        </Field>
        <Field label="New password" hint="At least 8 characters with a letter and a number">
          <input type="password" className="input" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} autoComplete="new-password" required />
        </Field>
        <Field label="Confirm new password">
          <input type="password" className="input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" required />
        </Field>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update Password'}</button>
      </form>
    </div>
  );
}
