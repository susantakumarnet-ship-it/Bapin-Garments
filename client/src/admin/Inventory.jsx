import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, History, Search, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, qs, useApi } from '../lib/api';
import { fmtDate, imgSrc, num } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Empty, ErrorBox, Field, Modal, Pagination, Spinner } from '../components/ui';
import { FilterBar, PageHeader, StockBadge } from './ui';

const TYPES = {
  IN: { label: 'Stock In', icon: ArrowDownToLine, cls: 'text-emerald-600', hint: 'New stock received (purchase, return from customer)' },
  OUT: { label: 'Stock Out', icon: ArrowUpFromLine, cls: 'text-red-600', hint: 'Stock leaving (sale, damage, return to supplier)' },
  ADJUST: { label: 'Set Exact Qty', icon: SlidersHorizontal, cls: 'text-sky-600', hint: 'Correct the count after a physical stock check' },
};
const REASONS = {
  IN: ['Purchase from supplier', 'Customer return', 'Transfer in', 'Other'],
  OUT: ['Counter sale', 'Damaged / defective', 'Return to supplier', 'Transfer out', 'Other'],
  ADJUST: ['Physical stock audit', 'Correction', 'Other'],
};

export default function Inventory() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const f = {
    q: params.get('q') || '',
    category_id: params.get('category_id') || '',
    stock_status: params.get('stock_status') || '',
    size: params.get('size') || '',
    page: params.get('page') || '1',
  };
  const [search, setSearch] = useState(f.q);
  const { data, loading, error, reload } = useApi(`/admin/inventory${qs({ ...f, limit: 50 })}`);
  const { data: cats } = useApi('/admin/categories');
  const [move, setMove] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const open = (row, type) => setMove({ row, type, quantity: type === 'ADJUST' ? row.quantity : '', reason: REASONS[type][0], reference: '' });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api('/admin/inventory/transactions', {
        method: 'POST',
        body: { variant_id: move.row.variant_id, type: move.type, quantity: Number(move.quantity), reason: move.reason, reference: move.reference },
      });
      toast.success(`Stock updated. New quantity: ${r.results[0].quantity}`);
      setMove(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const preview = move
    ? move.type === 'IN'
      ? move.row.quantity + (Number(move.quantity) || 0)
      : move.type === 'OUT'
        ? move.row.quantity - (Number(move.quantity) || 0)
        : Number(move.quantity) || 0
    : 0;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Size-wise and colour-wise stock. Record stock in, stock out and adjustments."
        actions={<Link to="/admin/stock-history" className="btn-outline"><History className="h-4 w-4" /> Stock History</Link>}
      />

      {data?.summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-3"><p className="text-xs text-slate-500">Variants shown</p><p className="text-xl font-semibold text-navy-900">{num(data.summary.variants)}</p></div>
          <div className="card p-3"><p className="text-xs text-slate-500">Units in stock</p><p className="text-xl font-semibold text-navy-900">{num(data.summary.units)}</p></div>
          <button className="card p-3 text-left hover:shadow-md" onClick={() => update({ stock_status: 'low_stock' })}><p className="text-xs text-slate-500">Filter</p><p className="text-sm font-semibold text-amber-600">Show low stock →</p></button>
          <button className="card p-3 text-left hover:shadow-md" onClick={() => update({ stock_status: 'out_of_stock' })}><p className="text-xs text-slate-500">Filter</p><p className="text-sm font-semibold text-red-600">Show out of stock →</p></button>
        </div>
      )}

      <FilterBar>
        <form className="relative min-w-52 flex-[2]" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
          <span className="label">Search</span>
          <input className="input pl-9" placeholder="Product, SKU, colour..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search className="absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" />
        </form>
        <label className="min-w-40 flex-1">
          <span className="label">Category</span>
          <select className="input" value={f.category_id} onChange={(e) => update({ category_id: e.target.value })}>
            <option value="">All</option>
            {cats?.items.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
          </select>
        </label>
        <label className="min-w-28">
          <span className="label">Size</span>
          <input className="input" value={f.size} onChange={(e) => update({ size: e.target.value })} placeholder="e.g. M" />
        </label>
        <label className="min-w-36">
          <span className="label">Stock status</span>
          <select className="input" value={f.stock_status} onChange={(e) => update({ stock_status: e.target.value })}>
            <option value="">All</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </label>
      </FilterBar>

      <ErrorBox error={error} onRetry={reload} />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
        ) : !data?.items.length ? (
          <Empty title="No stock records" text="No variants match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Size</th>
                  <th>Colour</th>
                  <th>Variant SKU</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Min</th>
                  <th>Status</th>
                  <th>Updated</th>
                  {can('stock.write') && <th className="text-right">Update stock</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.variant_id} className={!r.is_active ? 'opacity-50' : ''}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <img src={imgSrc(r.image, 80)} alt="" className="h-10 w-8 rounded object-cover" />
                        <div className="min-w-0">
                          <Link to={`/admin/products/${r.product_id}`} className="line-clamp-1 font-medium text-navy-800 hover:text-maroon-700">{r.product_name}</Link>
                          <p className="text-xs text-slate-400">{r.category_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-medium">{r.size}</td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: r.color_hex || '#ccc' }} /> {r.color}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{r.variant_sku}</td>
                    <td className="text-right text-base font-semibold text-navy-900">{r.quantity}</td>
                    <td className="text-right text-slate-500">{r.threshold}</td>
                    <td><StockBadge status={r.stock_status} /></td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(r.updated_at)}</td>
                    {can('stock.write') && (
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="btn-sm btn border border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => open(r, 'IN')} title="Stock in">
                            <ArrowDownToLine className="h-3.5 w-3.5" /> In
                          </button>
                          <button className="btn-sm btn border border-red-200 text-red-700 hover:bg-red-50" onClick={() => open(r, 'OUT')} disabled={r.quantity === 0} title="Stock out">
                            <ArrowUpFromLine className="h-3.5 w-3.5" /> Out
                          </button>
                          <button className="btn-ghost btn-sm" onClick={() => open(r, 'ADJUST')} title="Set exact quantity">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => update({ page: String(page) })} />}

      <Modal
        open={Boolean(move)}
        onClose={() => setMove(null)}
        title={move ? TYPES[move.type].label : ''}
        size="max-w-md"
        footer={
          <>
            <button className="btn-outline" onClick={() => setMove(null)}>Cancel</button>
            <button form="move-form" className="btn-primary" disabled={saving || preview < 0}>{saving ? 'Saving…' : 'Confirm'}</button>
          </>
        }
      >
        {move && (
          <form id="move-form" onSubmit={submit} className="space-y-4">
            <div className="rounded-lg bg-cream p-3 text-sm">
              <p className="font-medium text-navy-800">{move.row.product_name}</p>
              <p className="text-xs text-slate-500">Size {move.row.size} · {move.row.color} · {move.row.variant_sku}</p>
              <p className="mt-1 text-xs text-slate-500">Current stock: <b className="text-navy-900">{move.row.quantity}</b></p>
            </div>
            <p className="text-xs text-slate-500">{TYPES[move.type].hint}</p>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
              {Object.entries(TYPES).map(([t, cfg]) => (
                <button type="button" key={t} onClick={() => setMove({ ...move, type: t, reason: REASONS[t][0], quantity: t === 'ADJUST' ? move.row.quantity : '' })} className={`flex-1 rounded-md py-1.5 font-medium ${move.type === t ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500'}`}>
                  {cfg.label}
                </button>
              ))}
            </div>
            <Field label={move.type === 'ADJUST' ? 'New exact quantity' : 'Quantity'}>
              <input type="number" min={move.type === 'ADJUST' ? 0 : 1} className="input text-lg" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} autoFocus required />
            </Field>
            <Field label="Reason">
              <select className="input" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })}>
                {REASONS[move.type].map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Reference (optional)" hint="Bill no., PO no., supplier name...">
              <input className="input" value={move.reference} onChange={(e) => setMove({ ...move, reference: e.target.value })} maxLength={100} />
            </Field>
            <p className={`text-sm ${preview < 0 ? 'text-red-600' : 'text-slate-600'}`}>
              Stock after update: <b>{preview}</b> {preview < 0 && '— not enough stock'}
            </p>
          </form>
        )}
      </Modal>
    </>
  );
}
