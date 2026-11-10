import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { qs, useApi } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Empty, ErrorBox, Pagination, Spinner } from '../components/ui';
import { FilterBar, PageHeader } from './ui';

const TYPE_BADGE = { IN: 'badge-green', OUT: 'badge-red', ADJUST: 'badge-blue' };
const TYPE_LABEL = { IN: 'Stock In', OUT: 'Stock Out', ADJUST: 'Adjustment' };

export default function StockHistory() {
  const [params, setParams] = useSearchParams();
  const f = {
    q: params.get('q') || '',
    type: params.get('type') || '',
    product_id: params.get('product_id') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    page: params.get('page') || '1',
  };
  const [search, setSearch] = useState(f.q);
  const { data, loading, error, reload } = useApi(`/admin/inventory/transactions${qs({ ...f, limit: 50 })}`);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  return (
    <>
      <PageHeader title="Stock History" subtitle="Complete audit trail of every stock in, stock out and adjustment" />
      <FilterBar>
        <form className="relative min-w-52 flex-[2]" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
          <span className="label">Search</span>
          <input className="input pl-9" placeholder="Product, SKU, reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search className="absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" />
        </form>
        <label className="min-w-36">
          <span className="label">Type</span>
          <select className="input" value={f.type} onChange={(e) => update({ type: e.target.value })}>
            <option value="">All</option>
            <option value="IN">Stock In</option>
            <option value="OUT">Stock Out</option>
            <option value="ADJUST">Adjustment</option>
          </select>
        </label>
        <label><span className="label">From</span><input type="date" className="input" value={f.from} onChange={(e) => update({ from: e.target.value })} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={f.to} onChange={(e) => update({ to: e.target.value })} /></label>
        {f.product_id && <button className="btn-ghost" onClick={() => update({ product_id: '' })}>Clear product filter ✕</button>}
      </FilterBar>

      <ErrorBox error={error} onRetry={reload} />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
        ) : !data?.items.length ? (
          <Empty title="No stock movements" text="Stock movements will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>Type</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Balance</th>
                  <th>Reason</th>
                  <th>Reference</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => {
                  const signed = t.type === 'OUT' ? -t.quantity : t.quantity;
                  return (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(t.created_at, true)}</td>
                      <td>
                        <Link to={`/admin/products/${t.product_id}`} className="font-medium text-navy-800 hover:text-maroon-700">{t.product_name}</Link>
                        <p className="font-mono text-xs text-slate-400">{t.product_sku}</p>
                      </td>
                      <td className="text-slate-600">{t.variant_label}</td>
                      <td><span className={TYPE_BADGE[t.type]}>{TYPE_LABEL[t.type]}</span></td>
                      <td className={`text-right font-semibold ${signed < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{signed > 0 ? '+' : ''}{signed}</td>
                      <td className="text-right font-semibold text-navy-900">{t.balance_after}</td>
                      <td className="text-slate-600">{t.reason || '—'}</td>
                      <td className="text-xs text-slate-500">{t.reference || '—'}</td>
                      <td className="text-xs text-slate-500">{t.admin_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => update({ page: String(page) })} />}
    </>
  );
}
