import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, Boxes, FolderTree, MessageSquare, MessageSquarePlus, Package, PackageX, RotateCcw, Star } from 'lucide-react';
import { useApi, qs } from '../lib/api';
import { ENQUIRY_STATUS, inr, num, timeAgo } from '../lib/format';
import { ErrorBox, PageLoader } from '../components/ui';
import { FilterBar, PageHeader, StatCard } from './ui';

// Categorical palette validated for CVD separation & contrast (dataviz validator).
const C1 = '#3A5BA0'; // blue
const C2 = '#B8344A'; // maroon
const STATUS_COLORS = { in_stock: '#059669', low_stock: '#D97706', out_of_stock: '#DC2626' };
const STATUS_LABEL = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' };
const axis = { fontSize: 11, fill: '#64748b' };
const grid = { stroke: '#eef0f3', vertical: false };

function ChartCard({ title, subtitle, children, action, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-navy-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const TooltipBox = ({ active, payload, label, unit = '' }) =>
  active && payload?.length ? (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-navy-800">{label ?? payload[0].payload.name}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload.fill }} />
          {p.name}: <span className="font-semibold text-navy-900">{num(p.value)}{unit}</span>
        </p>
      ))}
    </div>
  ) : null;

function HBarList({ data, dataKey, nameKey = 'name', color, unit, onClick }) {
  if (!data?.length) return <p className="py-10 text-center text-sm text-slate-400">No data for the selected filters</p>;
  const max = Math.max(...data.map((d) => d[dataKey]), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.id ?? d[nameKey]} className="group">
          <button type="button" onClick={() => onClick?.(d)} className="w-full text-left" title={`${d[nameKey]}: ${num(d[dataKey])} ${unit}`}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="truncate text-slate-700 group-hover:text-maroon-700">{d[nameKey]}</span>
              <span className="shrink-0 font-semibold text-navy-900">{num(d[dataKey])} <span className="font-normal text-slate-400">{unit}</span></span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full transition-all" style={{ width: `${(d[dataKey] / max) * 100}%`, background: color }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [f, setF] = useState({ category_id: '', product_id: '', stock_status: '', from: '', to: '' });
  const [catView, setCatView] = useState('department');
  const { data, loading, error, reload } = useApi(`/admin/dashboard${qs(f)}`);
  const { data: cats } = useApi('/admin/categories');
  const { data: prods } = useApi(`/admin/products${qs({ limit: 200, sort: 'name', category_id: f.category_id })}`);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value, ...(k === 'category_id' ? { product_id: '' } : {}) }));
  const hasFilter = Object.values(f).some(Boolean);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { cards, charts } = data;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Real-time overview of your inventory and customer enquiries" />

      <FilterBar>
        <label className="min-w-40 flex-1">
          <span className="label">Category</span>
          <select className="input" value={f.category_id} onChange={set('category_id')}>
            <option value="">All categories</option>
            {cats?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>
            ))}
          </select>
        </label>
        <label className="min-w-40 flex-1">
          <span className="label">Product</span>
          <select className="input" value={f.product_id} onChange={set('product_id')}>
            <option value="">All products</option>
            {prods?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="min-w-36">
          <span className="label">Stock status</span>
          <select className="input" value={f.stock_status} onChange={set('stock_status')}>
            <option value="">Any</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </label>
        <label>
          <span className="label">From</span>
          <input type="date" className="input" value={f.from} onChange={set('from')} />
        </label>
        <label>
          <span className="label">To</span>
          <input type="date" className="input" value={f.to} onChange={set('to')} />
        </label>
        {hasFilter && (
          <button className="btn-ghost" onClick={() => setF({ category_id: '', product_id: '', stock_status: '', from: '', to: '' })}>
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}
      </FilterBar>
      {(f.from || f.to) && <p className="-mt-3 text-xs text-slate-500">Date range applies to enquiry figures; stock figures show current levels.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Package} label="Total Products" value={num(cards.total_products)} hint={`Stock value ${inr(cards.stock_value)}`} onClick={() => navigate('/admin/products')} />
        <StatCard icon={FolderTree} label="Total Categories" value={num(cards.total_categories)} tone="violet" onClick={() => navigate('/admin/categories')} />
        <StatCard icon={Boxes} label="Garments in Stock" value={num(cards.total_units)} tone="green" hint="Total units across all variants" onClick={() => navigate('/admin/inventory')} />
        <StatCard icon={PackageX} label="Out of Stock Products" value={num(cards.out_of_stock)} tone="red" onClick={() => navigate('/admin/products?stock_status=out_of_stock')} />
        <StatCard icon={AlertTriangle} label="Low Stock Products" value={num(cards.low_stock)} tone="amber" hint={`Threshold: ≤ ${data.threshold} units`} onClick={() => navigate('/admin/products?stock_status=low_stock')} />
        <StatCard icon={MessageSquare} label="Total Enquiries" value={num(cards.total_enquiries)} tone="sky" hint={`${cards.enquiries_7d} in last 7 days`} onClick={() => navigate('/admin/enquiries')} />
        <StatCard icon={MessageSquarePlus} label="New Enquiries" value={num(cards.new_enquiries)} tone="maroon" hint="Awaiting response" onClick={() => navigate('/admin/enquiries?status=New')} />
        <StatCard icon={Star} label="Featured Products" value={num(cards.featured)} tone="gold" onClick={() => navigate('/admin/products?tag=featured')} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Category-wise Stock Distribution"
          subtitle="Units currently in stock"
          action={
            <div className="flex rounded-md bg-slate-100 p-0.5 text-xs">
              {['department', 'category'].map((v) => (
                <button key={v} onClick={() => setCatView(v)} className={`rounded px-2.5 py-1 capitalize ${catView === v ? 'bg-white font-semibold text-navy-800 shadow-sm' : 'text-slate-500'}`}>
                  {v}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={catView === 'department' ? charts.category_stock : charts.category_stock_detail} margin={{ left: -10, right: 8 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="name" tick={axis} interval={0} angle={catView === 'category' ? -30 : 0} textAnchor={catView === 'category' ? 'end' : 'middle'} height={catView === 'category' ? 70 : 30} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="units" name="Units in stock" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Stock Availability Analysis" subtitle="Products by stock status">
          <div className="space-y-4 pt-2">
            {charts.availability.map((a) => {
              const total = charts.availability.reduce((s, x) => s + x.products, 0) || 1;
              return (
                <button key={a.status} className="block w-full text-left" onClick={() => navigate(`/admin/products?stock_status=${a.status}`)}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[a.status] }} /> {STATUS_LABEL[a.status]}
                    </span>
                    <span className="font-semibold text-navy-900">
                      {a.products} <span className="text-xs font-normal text-slate-400">({Math.round((a.products / total) * 100)}%)</span>
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="h-3 rounded-full" style={{ width: `${(a.products / total) * 100}%`, background: STATUS_COLORS[a.status] }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{num(a.units)} units</p>
                </button>
              );
            })}
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Monthly Product Additions" subtitle="New products added per month (last 12 months)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts.monthly} margin={{ left: -20, right: 8 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={axis} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="products_added" name="Products added" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Stock Movement" subtitle="Units received (stock in) vs. sold/removed (stock out)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts.monthly} margin={{ left: -15, right: 8 }} barGap={2}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: '#f1f5f9' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="stock_in" name="Stock in" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="stock_out" name="Stock out" fill={C2} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Most Viewed Products" subtitle="Website product page views">
          <HBarList data={charts.most_viewed} dataKey="view_count" color={C1} unit="views" onClick={(d) => navigate(`/admin/products/${d.id}`)} />
        </ChartCard>
        <ChartCard title="Most Enquired Products" subtitle={f.from || f.to ? 'Within selected dates' : 'All time'}>
          <HBarList data={charts.most_enquired} dataKey="enquiries" color={C2} unit="enquiries" onClick={(d) => navigate(`/admin/enquiries?product_id=${d.id}`)} />
        </ChartCard>
        <ChartCard title="Enquiries – Last 30 Days" subtitle="Daily customer enquiries">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={charts.enquiry_trend} margin={{ left: -25, right: 8 }}>
              <defs>
                <linearGradient id="enqFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C2} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={C2} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...grid} />
              <XAxis dataKey="label" tick={axis} interval={6} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={axis} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
              <Area type="linear" dataKey="enquiries" name="Enquiries" stroke={C2} strokeWidth={2} fill="url(#enqFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Low Stock Alerts" subtitle={`Variants at or below their minimum level`} action={<Link to="/admin/inventory?stock_status=low_stock" className="text-xs font-semibold text-maroon-700">View all →</Link>}>
          {data.low_stock_items.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="table-x">
                <thead><tr><th>Product</th><th>Variant</th><th className="text-right">Qty</th></tr></thead>
                <tbody>
                  {data.low_stock_items.map((v) => (
                    <tr key={v.variant_id}>
                      <td><Link to={`/admin/products/${v.product_id}`} className="font-medium text-navy-800 hover:text-maroon-700">{v.name}</Link><p className="text-xs text-slate-400">{v.sku}</p></td>
                      <td className="text-slate-600">{v.size} / {v.color}</td>
                      <td className="text-right"><span className={v.quantity === 0 ? 'badge-red' : 'badge-amber'}>{v.quantity}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">All variants are well stocked 🎉</p>
          )}
        </ChartCard>

        <ChartCard title="Recent Enquiries" action={<Link to="/admin/enquiries" className="text-xs font-semibold text-maroon-700">View all →</Link>}>
          {data.recent_enquiries.length ? (
            <ul className="divide-y divide-slate-100">
              {data.recent_enquiries.map((e) => (
                <li key={e.id}>
                  <Link to={`/admin/enquiries?open=${e.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-50 text-sm font-semibold text-navy-800">{e.name[0]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-800">{e.name} <span className="font-normal text-slate-400">· {e.mobile}</span></p>
                      <p className="truncate text-xs text-slate-500">{e.product_name || e.subject}</p>
                    </div>
                    <div className="text-right">
                      <span className={ENQUIRY_STATUS[e.status]}>{e.status}</span>
                      <p className="mt-1 text-[11px] text-slate-400">{timeAgo(e.created_at)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No enquiries yet</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

