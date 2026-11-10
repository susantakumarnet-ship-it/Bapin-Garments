import { useState } from 'react';
import { AlertTriangle, Boxes, CalendarDays, Eye, FileSpreadsheet, FileText, FolderTree, List, MessageSquare, PackageX } from 'lucide-react';
import { qs, useApi } from '../lib/api';
import { fmtDate, inr } from '../lib/format';
import { Modal, Spinner } from '../components/ui';
import { PageHeader } from './ui';

const REPORTS = [
  { key: 'products', title: 'Complete Product List', icon: List, text: 'All products with prices, discount, stock and labels.', filters: ['category'] },
  { key: 'category-inventory', title: 'Category-wise Inventory', icon: FolderTree, text: 'Products, variants, units and stock value per category.' },
  { key: 'available-stock', title: 'Available Stock Report', icon: Boxes, text: 'Every size/colour variant currently in stock, with value.', filters: ['category'] },
  { key: 'low-stock', title: 'Low Stock Report', icon: AlertTriangle, text: 'Variants at or below their minimum stock level.', filters: ['category'] },
  { key: 'out-of-stock', title: 'Out of Stock Report', icon: PackageX, text: 'Variants with zero stock that need reordering.', filters: ['category'] },
  { key: 'enquiries', title: 'Customer Enquiry Report', icon: MessageSquare, text: 'All enquiries with status and remarks.', filters: ['dates', 'status'] },
  { key: 'monthly-inventory', title: 'Monthly Inventory Report', icon: CalendarDays, text: 'Opening, stock in, stock out, adjustments and closing per product.', filters: ['month', 'category'] },
];

function cell(col, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (col.type === 'money') return inr(v);
  if (col.type === 'date') return fmtDate(v);
  if (col.type === 'datetime') return fmtDate(v, true);
  return String(v);
}

export default function Reports() {
  const { data: cats } = useApi('/admin/categories');
  const now = new Date();
  const [params, setParams] = useState({
    category_id: '',
    from: '',
    to: '',
    status: '',
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  });
  const [preview, setPreview] = useState(null);

  const paramsFor = (r) => {
    const p = {};
    if (r.filters?.includes('category')) p.category_id = params.category_id;
    if (r.filters?.includes('dates')) Object.assign(p, { from: params.from, to: params.to });
    if (r.filters?.includes('status')) p.status = params.status;
    if (r.filters?.includes('month')) p.month = params.month;
    return p;
  };
  const href = (r, format) => `/api/admin/reports/${r.key}${qs({ ...paramsFor(r), format })}`;

  return (
    <>
      <PageHeader title="Reports & Exports" subtitle="Download inventory and enquiry reports as Excel or PDF" />

      <div className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label>
          <span className="label">Category</span>
          <select className="input" value={params.category_id} onChange={(e) => setParams({ ...params, category_id: e.target.value })}>
            <option value="">All categories</option>
            {cats?.items.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Month (monthly report)</span>
          <input type="month" className="input" value={params.month} onChange={(e) => setParams({ ...params, month: e.target.value })} />
        </label>
        <label>
          <span className="label">Enquiries from</span>
          <input type="date" className="input" value={params.from} onChange={(e) => setParams({ ...params, from: e.target.value })} />
        </label>
        <label>
          <span className="label">Enquiries to</span>
          <input type="date" className="input" value={params.to} onChange={(e) => setParams({ ...params, to: e.target.value })} />
        </label>
        <label>
          <span className="label">Enquiry status</span>
          <select className="input" value={params.status} onChange={(e) => setParams({ ...params, status: e.target.value })}>
            <option value="">All</option>
            {['New', 'Contacted', 'Pending', 'Closed'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.key} className="card flex flex-col p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-800"><r.icon className="h-5 w-5" /></div>
              <div>
                <h3 className="font-semibold text-navy-800">{r.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{r.text}</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              <button className="btn-outline btn-sm" onClick={() => setPreview(r)}><Eye className="h-3.5 w-3.5" /> Preview</button>
              <a className="btn-sm btn bg-emerald-600 text-white hover:bg-emerald-700" href={href(r, 'xlsx')}><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</a>
              <a className="btn-sm btn bg-maroon-700 text-white hover:bg-maroon-800" href={href(r, 'pdf')}><FileText className="h-3.5 w-3.5" /> PDF</a>
            </div>
          </div>
        ))}
      </div>

      {preview && <Preview report={preview} path={href(preview, 'json').replace('/api', '')} onClose={() => setPreview(null)} xlsx={href(preview, 'xlsx')} pdf={href(preview, 'pdf')} />}
    </>
  );
}

function Preview({ report, path, onClose, xlsx, pdf }) {
  const { data, loading, error } = useApi(path);
  return (
    <Modal
      open
      onClose={onClose}
      title={report.title}
      size="max-w-6xl"
      footer={
        <>
          <a className="btn-sm btn bg-emerald-600 text-white" href={xlsx}><FileSpreadsheet className="h-4 w-4" /> Excel</a>
          <a className="btn-sm btn bg-maroon-700 text-white" href={pdf}><FileText className="h-4 w-4" /> PDF</a>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <p className="text-red-600">{error.message}</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500">
            {data.subtitle && `${data.subtitle} · `}{data.total_rows} records{data.total_rows > data.rows.length && ` (showing first ${data.rows.length})`}
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="table-x text-xs">
              <thead>
                <tr>{data.columns.map((c) => <th key={c.key} className={c.type === 'int' || c.type === 'money' ? 'text-right' : ''}>{c.header}</th>)}</tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i}>
                    {data.columns.map((c) => (
                      <td key={c.key} className={`${c.type === 'int' || c.type === 'money' ? 'text-right' : ''} max-w-64 truncate`}>{cell(c, r[c.key])}</td>
                    ))}
                  </tr>
                ))}
                {data.totals && (
                  <tr className="bg-gold-100 font-semibold">
                    {data.columns.map((c, i) => (
                      <td key={c.key} className={c.type === 'int' || c.type === 'money' ? 'text-right' : ''}>{i === 0 ? 'TOTAL' : c.key in data.totals ? cell(c, data.totals[c.key]) : ''}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
