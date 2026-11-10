import { useState } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, useApi } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Field, Modal, PageLoader } from '../components/ui';
import { PageHeader, Toggle, useConfirm } from './ui';

const ROLES = {
  super_admin: { label: 'Super Admin', cls: 'badge-maroon', text: 'Full access including admin user management' },
  admin: { label: 'Admin', cls: 'badge-gold', text: 'Products, categories, stock, enquiries, reports and settings' },
  staff: { label: 'Staff', cls: 'badge-slate', text: 'View products, record stock in/out, handle enquiries, reports' },
};

export default function Users() {
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useApi('/admin/users');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (edit.id) await api(`/admin/users/${edit.id}`, { method: 'PUT', body: { name: edit.name, email: edit.email, role: edit.role, is_active: edit.is_active, password: edit.password } });
      else await api('/admin/users', { method: 'POST', body: edit });
      toast.success('User saved');
      setEdit(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (!(await confirm(`Delete admin user ${u.name}?`, { okText: 'Delete' }))) return;
    try {
      await api(`/admin/users/${u.id}`, { method: 'DELETE' });
      toast.success('User deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Admin Users"
        subtitle="Manage who can access the admin portal and what they can do"
        actions={<button className="btn-primary" onClick={() => setEdit({ name: '', username: '', email: '', role: 'staff', password: '', is_active: true })}><UserPlus className="h-4 w-4" /> Add User</button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {Object.entries(ROLES).map(([k, r]) => (
          <div key={k} className="card p-3 text-xs text-slate-600"><span className={r.cls}>{r.label}</span><p className="mt-1.5">{r.text}</p></div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table-x">
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-navy-800">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}</td>
                <td className="font-mono text-xs">{u.username}</td>
                <td className="text-slate-600">{u.email}</td>
                <td><span className={ROLES[u.role].cls}>{ROLES[u.role].label}</span></td>
                <td>{u.is_active ? <span className="badge-green">Active</span> : <span className="badge-red">Disabled</span>}</td>
                <td className="text-xs text-slate-500">{fmtDate(u.last_login_at, true)}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...u, password: '' })}><Pencil className="h-4 w-4" /></button>
                    {u.id !== me.id && <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => remove(u)}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit User' : 'Add Admin User'}
        footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button form="user-form" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}
      >
        {edit && (
          <form id="user-form" onSubmit={save} className="space-y-4">
            <Field label="Full name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Username"><input className="input font-mono" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} required disabled={Boolean(edit.id)} /></Field>
            <Field label="Email"><input className="input" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required /></Field>
            <Field label="Role">
              <select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} disabled={edit.id === me.id}>
                {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
              </select>
            </Field>
            <Field label={edit.id ? 'New password (optional)' : 'Password'} hint="At least 8 characters with a letter and a number">
              <input className="input" type="password" autoComplete="new-password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} required={!edit.id} />
            </Field>
            {edit.id && edit.id !== me.id && <Toggle checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Account active" />}
          </form>
        )}
      </Modal>
      {confirmDialog}
    </>
  );
}
