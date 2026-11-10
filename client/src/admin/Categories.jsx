import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, useApi } from '../lib/api';
import { imgSrc, num } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Field, Modal, PageLoader } from '../components/ui';
import { PageHeader, Toggle, useConfirm } from './ui';

const EMPTY = { name: '', slug: '', parent_id: '', description: '', image_url: '', sort_order: 0, is_active: true };

export default function Categories() {
  const { can } = useAuth();
  const canWrite = can('categories.write');
  const { data, loading, error, reload } = useApi('/admin/categories');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...edit, parent_id: edit.parent_id ? Number(edit.parent_id) : null, sort_order: Number(edit.sort_order) || 0 };
      if (edit.id) await api(`/admin/categories/${edit.id}`, { method: 'PUT', body });
      else await api('/admin/categories', { method: 'POST', body });
      toast.success('Category saved');
      setEdit(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!(await confirm(`Delete category "${c.name}"?`, { okText: 'Delete' }))) return;
    try {
      await api(`/admin/categories/${c.id}`, { method: 'DELETE' });
      toast.success('Category deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const parents = data.items.filter((c) => !c.parent_id);

  const Row = ({ c, depth }) => (
    <tr className={!c.is_active ? 'opacity-50' : ''}>
      <td>
        <div className="flex items-center gap-3" style={{ paddingLeft: depth * 28 }}>
          {depth > 0 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          <img src={imgSrc(c.image_url, 80)} alt="" className="h-10 w-10 rounded-md object-cover" />
          <div>
            <p className={`text-navy-800 ${depth === 0 ? 'font-semibold' : 'font-medium'}`}>{c.name}</p>
            <p className="font-mono text-xs text-slate-400">/{c.slug}</p>
          </div>
        </div>
      </td>
      <td className="text-right">
        <Link to={`/admin/products?category_id=${c.id}`} className="hover:text-maroon-700">{c.product_count}</Link>
      </td>
      <td className="text-right">{num(c.stock)}</td>
      <td className="text-right text-slate-500">{c.sort_order}</td>
      <td>{c.is_active ? <span className="badge-green">Active</span> : <span className="badge-slate">Hidden</span>}</td>
      <td>
        {canWrite && (
          <div className="flex justify-end gap-1">
            <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...EMPTY, ...c, parent_id: c.parent_id || '', image_url: c.image_url || '', description: c.description || '' })} title="Edit"><Pencil className="h-4 w-4" /></button>
            <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => remove(c)} title="Delete"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </td>
    </tr>
  );

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle={`${data.items.length} categories`}
        actions={canWrite && <button className="btn-primary" onClick={() => setEdit({ ...EMPTY })}><FolderPlus className="h-4 w-4" /> Add Category</button>}
      />
      <div className="card overflow-x-auto">
        <table className="table-x">
          <thead>
            <tr>
              <th>Category</th>
              <th className="text-right">Products</th>
              <th className="text-right">Units</th>
              <th className="text-right">Order</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.tree.map((p) => (
              <FragmentRows key={p.id} node={p} Row={Row} depth={0} />
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit Category' : 'Add Category'}
        footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button form="cat-form" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}
      >
        {edit && (
          <form id="cat-form" onSubmit={save} className="space-y-4">
            <Field label="Name *"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required maxLength={100} /></Field>
            <Field label="URL slug" hint="Leave empty to generate from the name"><input className="input font-mono" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} maxLength={120} /></Field>
            <Field label="Parent category">
              <select className="input" value={edit.parent_id} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value })}>
                <option value="">— None (top level) —</option>
                {parents.filter((p) => p.id !== edit.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Image URL" hint="Shown in menus and the Shop by Category section"><input className="input" value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} placeholder="https://..." /></Field>
            <Field label="Description"><textarea className="input" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={1000} /></Field>
            <div className="flex items-end gap-6">
              <Field label="Sort order" className="w-28"><input type="number" min="0" className="input" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} /></Field>
              <div className="pb-2"><Toggle checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Visible on website" /></div>
            </div>
          </form>
        )}
      </Modal>
      {confirmDialog}
    </>
  );
}

function FragmentRows({ node, Row, depth }) {
  return (
    <>
      <Row c={node} depth={depth} />
      {node.children?.map((ch) => <FragmentRows key={ch.id} node={ch} Row={Row} depth={depth + 1} />)}
    </>
  );
}
