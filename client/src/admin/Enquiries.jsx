import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Mail, Phone, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, qs, useApi } from '../lib/api';
import { ENQUIRY_STATUS, fmtDate, timeAgo, waLink } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Empty, ErrorBox, Modal, Pagination, Spinner } from '../components/ui';
import { WhatsAppIcon } from '../components/store/WhatsAppButton';
import { FilterBar, PageHeader, useConfirm } from './ui';

const STATUSES = ['New', 'Contacted', 'Pending', 'Closed'];

export default function Enquiries() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const f = {
    q: params.get('q') || '',
    status: params.get('status') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    product_id: params.get('product_id') || '',
    page: params.get('page') || '1',
  };
  const [search, setSearch] = useState(f.q);
  const { data, loading, error, reload } = useApi(`/admin/enquiries${qs({ ...f, limit: 20 })}`);
  const [openId, setOpenId] = useState(params.get('open') ? Number(params.get('open')) : null);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!('page' in patch)) next.delete('page');
    next.delete('open');
    setParams(next);
  };

  return (
    <>
      <PageHeader
        title="Customer Enquiries"
        subtitle="Respond to customers, track status and add internal remarks"
        actions={
          <a className="btn-outline" href={`/api/admin/reports/enquiries${qs({ ...f, page: undefined, format: 'xlsx' })}`}>
            <Download className="h-4 w-4" /> Export Excel
          </a>
        }
      />

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <button onClick={() => update({ status: '' })} className={`btn-sm btn shrink-0 ${!f.status ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
          All {data && `(${Object.values(data.counts).reduce((a, b) => a + b, 0)})`}
        </button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => update({ status: s })} className={`btn-sm btn shrink-0 ${f.status === s ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {s} {data && <span className="opacity-70">({data.counts[s]})</span>}
          </button>
        ))}
      </div>

      <FilterBar>
        <form className="relative min-w-60 flex-[2]" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
          <span className="label">Search</span>
          <input className="input pl-9" placeholder="Customer name, mobile, email, product..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search className="absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" />
        </form>
        <label><span className="label">From</span><input type="date" className="input" value={f.from} onChange={(e) => update({ from: e.target.value })} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={f.to} onChange={(e) => update({ to: e.target.value })} /></label>
        {(f.q || f.from || f.to || f.product_id) && (
          <button className="btn-ghost" onClick={() => { setSearch(''); update({ q: '', from: '', to: '', product_id: '' }); }}>Clear filters</button>
        )}
      </FilterBar>

      <ErrorBox error={error} onRetry={reload} />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
        ) : !data?.items.length ? (
          <Empty title="No enquiries found" text="Customer enquiries from the website will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Customer</th>
                  <th>Product / Subject</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th className="text-right">Contact</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className={`cursor-pointer ${e.status === 'New' ? 'bg-sky-50/40' : ''}`} onClick={() => setOpenId(e.id)}>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {fmtDate(e.created_at, true)}
                      <p className="text-slate-400">{timeAgo(e.created_at)}</p>
                    </td>
                    <td>
                      <p className="font-medium text-navy-800">{e.name}</p>
                      <p className="text-xs text-slate-500">{e.mobile}</p>
                    </td>
                    <td className="max-w-56">
                      <p className="line-clamp-1 text-navy-800">{e.product_name || '—'}</p>
                      <p className="line-clamp-1 text-xs text-slate-500">{e.subject}</p>
                    </td>
                    <td className="max-w-72"><p className="line-clamp-2 text-xs text-slate-600">{e.message}</p></td>
                    <td><span className={ENQUIRY_STATUS[e.status]}>{e.status}</span>{e.internal_remarks && <p className="mt-1 text-[10px] text-slate-400">has remarks</p>}</td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <a href={waLink(e.mobile, `Hello ${e.name}, thank you for contacting Bapin Garments regarding "${e.product_name || e.subject}".`)} target="_blank" rel="noreferrer" className="btn-sm btn bg-[#25D366] text-white hover:bg-[#1ebe5b]" title="WhatsApp customer">
                          <WhatsAppIcon className="h-3.5 w-3.5" />
                        </a>
                        <a href={`tel:${e.mobile}`} className="btn-ghost btn-sm" title="Call"><Phone className="h-3.5 w-3.5" /></a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => update({ page: String(page) })} />}

      <EnquiryDetail id={openId} onClose={() => setOpenId(null)} onChanged={reload} canWrite={can('enquiries.write')} canDelete={can('enquiries.delete')} />
    </>
  );
}

function EnquiryDetail({ id, onClose, onChanged, canWrite, canDelete }) {
  const { settings } = useStore();
  const { data: e, loading, setData } = useApi(id ? `/admin/enquiries/${id}` : null, { skip: !id });
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    if (e) setRemarks(e.internal_remarks || '');
  }, [e]);

  const save = async (patch) => {
    setSaving(true);
    try {
      const updated = await api(`/admin/enquiries/${id}`, { method: 'PUT', body: patch });
      setData((d) => ({ ...d, ...updated }));
      toast.success('Enquiry updated');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Delete this enquiry permanently?', { okText: 'Delete' }))) return;
    try {
      await api(`/admin/enquiries/${id}`, { method: 'DELETE' });
      toast.success('Enquiry deleted');
      onClose();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const reply = e
    ? `Hello ${e.name},\n\nThank you for your enquiry with ${settings.store_name}${e.product_name ? ` about *${e.product_name}*` : ''}.\n\n`
    : '';

  return (
    <Modal open={Boolean(id)} onClose={onClose} title={e ? `Enquiry #${e.id}` : 'Enquiry'} size="max-w-2xl">
      {loading || !e ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-navy-800">{e.name}</p>
              <p className="text-sm text-slate-600">{e.mobile}{e.email && ` · ${e.email}`}</p>
              <p className="mt-1 text-xs text-slate-400">Received {fmtDate(e.created_at, true)} via {e.source === 'product_page' ? 'product page' : 'contact form'}</p>
            </div>
            <div className="flex gap-2">
              <a href={waLink(e.mobile, reply)} target="_blank" rel="noreferrer" className="btn-whatsapp btn-sm"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
              <a href={`tel:${e.mobile}`} className="btn-outline btn-sm"><Phone className="h-4 w-4" /> Call</a>
              {e.email && <a href={`mailto:${e.email}`} className="btn-outline btn-sm"><Mail className="h-4 w-4" /></a>}
            </div>
          </div>

          <div className="rounded-lg bg-cream p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</p>
            <p className="text-sm font-medium text-navy-800">{e.subject}</p>
            {e.product_name && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Product interested in</p>
                <p className="text-sm text-navy-800">
                  {e.product_slug ? <Link to={`/admin/products/${e.product_id}`} className="text-maroon-700 hover:underline">{e.product_name}</Link> : e.product_name}
                </p>
              </>
            )}
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Message</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{e.message}</p>
          </div>

          <div>
            <p className="label">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button key={s} disabled={!canWrite || saving} onClick={() => save({ status: s })} className={`btn-sm btn ${e.status === s ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-navy-800'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Internal remarks (not visible to customer)</p>
            <textarea className="input min-h-24" value={remarks} onChange={(ev) => setRemarks(ev.target.value)} disabled={!canWrite} placeholder="e.g. Called customer, will visit on Saturday" maxLength={5000} />
            {canWrite && (
              <button className="btn-primary btn-sm mt-2" disabled={saving || remarks === (e.internal_remarks || '')} onClick={() => save({ internal_remarks: remarks })}>
                Save remarks
              </button>
            )}
          </div>

          {e.notifications?.length > 0 && (
            <div>
              <p className="label">Owner WhatsApp notification</p>
              {e.notifications.map((n) => (
                <p key={n.id} className="text-xs text-slate-600">
                  <span className={n.status === 'sent' ? 'badge-green' : n.status === 'failed' ? 'badge-red' : 'badge-slate'}>{n.status}</span>{' '}
                  {fmtDate(n.created_at, true)} {n.error && <span className="text-slate-400">— {n.error}</span>}
                </p>
              ))}
            </div>
          )}

          {e.history?.length > 0 && (
            <div>
              <p className="label">Previous enquiries from this customer</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
                {e.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-slate-700">{h.product_name || h.subject}</span>
                    <span className="shrink-0 text-xs text-slate-400">{fmtDate(h.created_at)} · <span className={ENQUIRY_STATUS[h.status]}>{h.status}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canDelete && (
            <div className="border-t border-slate-100 pt-4 text-right">
              <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={remove}><Trash2 className="h-4 w-4" /> Delete enquiry</button>
            </div>
          )}
        </div>
      )}
      {confirmDialog}
    </Modal>
  );
}
