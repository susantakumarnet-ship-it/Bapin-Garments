import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { api } from '../lib/api';
import { Field } from '../components/ui';
import AuthShell from './AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setMsg(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset Password" subtitle="Enter your registered admin email. We'll send you a secure reset link valid for 30 minutes.">
      {msg ? (
        <div className="space-y-4">
          <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700">{msg}</p>
          <Link to="/admin/login" className="btn-outline w-full">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email address">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full py-3" disabled={busy}>
            <Mail className="h-4 w-4" /> {busy ? 'Sending…' : 'Send Reset Link'}
          </button>
          <p className="text-center text-sm">
            <Link to="/admin/login" className="text-maroon-700 hover:underline">Back to login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
