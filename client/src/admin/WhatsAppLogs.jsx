import { useState } from 'react';
import { Link } from 'react-router-dom';
import { qs, useApi } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Empty, ErrorBox, Pagination, Spinner } from '../components/ui';
import { PageHeader } from './ui';

const BADGE = { sent: 'badge-green', failed: 'badge-red', skipped: 'badge-slate' };

export default function WhatsAppLogs() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(`/admin/settings/whatsapp/logs${qs({ status, page })}`);

  return (
    <>
      <PageHeader
        title="WhatsApp Notification Logs"
        subtitle="Delivery log of enquiry alerts sent to the store owner"
        actions={
          <select className="input w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
        ) : !data?.items.length ? (
          <Empty title="No notifications yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead><tr><th>Date</th><th>Enquiry</th><th>To</th><th>Template</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(l.created_at, true)}</td>
                    <td>{l.enquiry_id ? <Link className="text-maroon-700 hover:underline" to={`/admin/enquiries?open=${l.enquiry_id}`}>#{l.enquiry_id} {l.customer_name}</Link> : <span className="text-slate-400">Test message</span>}</td>
                    <td className="font-mono text-xs">{l.to_number || '—'}</td>
                    <td className="font-mono text-xs">{l.template_name || 'text'}</td>
                    <td><span className={BADGE[l.status]}>{l.status}</span></td>
                    <td className="max-w-md text-xs text-slate-500">{l.error || (l.provider_message_id ? `Message ID: ${l.provider_message_id}` : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  );
}
