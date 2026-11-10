import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';
import AuthShell from './AuthShell';

export default function Login() {
  const { user, login, checking } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!checking && user) return <Navigate to={location.state?.from || '/admin'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.identifier.trim(), form.password);
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Admin Login" subtitle="Sign in to manage your store">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username or Email">
          <input className="input" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} autoComplete="username" autoFocus required />
        </Field>
        <Field label="Password">
          <div className="relative">
            <input
              className="input pr-10"
              type={show ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              required
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400" aria-label="Toggle password visibility">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>
          <LogIn className="h-4 w-4" /> {busy ? 'Signing in…' : 'Sign In'}
        </button>
        <div className="text-center">
          <Link to="/admin/forgot-password" className="text-sm text-maroon-700 hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
