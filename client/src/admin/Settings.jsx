import { useEffect, useState } from 'react';
import { CheckCircle2, Info, Save, Send, ShieldCheck, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, useApi } from '../lib/api';
import { fmtDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Field, PageLoader } from '../components/ui';
import { PageHeader, Toggle } from './ui';

const TABS = [
  ['store', 'Store Information'],
  ['inventory', 'Inventory'],
  ['whatsapp', 'WhatsApp API'],
  ['notifications', 'Notifications'],
];

export default function Settings() {
  const { can } = useAuth();
  const canWrite = can('settings.write');
  const { data, loading, error, reload, setData } = useApi('/admin/settings');
  const [tab, setTab] = useState('store');
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);

  if (loading || !s) return error ? <ErrorBox error={error} onRetry={reload} /> : <PageLoader />;
  const wa = data.whatsapp;

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const setBool = (k) => (v) => setS({ ...s, [k]: String(v) });

  const save = async () => {
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(s).filter(([k]) => !k.endsWith('_set') && !k.endsWith('_hint')));
      const r = await api('/admin/settings', { method: 'PUT', body });
      setData(r);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await api('/admin/settings/whatsapp/test', { method: 'POST' });
      toast.success(r.message);
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setTesting(false);
      reload();
    }
  };

  const clearToken = async () => {
    try {
      setData(await api('/admin/settings/secret/wa_access_token', { method: 'DELETE' }));
      toast.success('Access token removed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="pb-20">
      <PageHeader title="Settings" subtitle="Store details, inventory rules and WhatsApp Business configuration" />

      <div className="no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === k ? 'border-maroon-700 text-maroon-700' : 'border-transparent text-slate-500 hover:text-navy-800'}`}>
            {l}
          </button>
        ))}
      </div>

      <fieldset disabled={!canWrite} className="max-w-3xl">
        {tab === 'store' && (
          <div className="card grid gap-4 p-6 sm:grid-cols-2">
            <Field label="Shop name"><input className="input" value={s.store_name} onChange={set('store_name')} /></Field>
            <Field label="Tagline"><input className="input" value={s.tagline} onChange={set('tagline')} /></Field>
            <Field label="Shop address" className="sm:col-span-2"><textarea className="input" rows={2} value={s.address} onChange={set('address')} /></Field>
            <Field label="Contact number"><input className="input" value={s.phone} onChange={set('phone')} /></Field>
            <Field label="WhatsApp number (click-to-chat)" hint="With country code, digits only, e.g. 919876543210"><input className="input" value={s.whatsapp_number} onChange={set('whatsapp_number')} /></Field>
            <Field label="Email"><input className="input" type="email" value={s.email} onChange={set('email')} /></Field>
            <Field label="Business hours"><textarea className="input" rows={2} value={s.business_hours} onChange={set('business_hours')} /></Field>
            <Field label="Google Maps embed URL" className="sm:col-span-2" hint="Google Maps → Share → Embed a map → copy the src=&quot;…&quot; URL"><input className="input" value={s.map_embed_url} onChange={set('map_embed_url')} /></Field>
            <Field label="Google Maps directions link" className="sm:col-span-2"><input className="input" value={s.map_link} onChange={set('map_link')} /></Field>
            <Field label="Announcement bar text" className="sm:col-span-2" hint="Scrolling message at the top of the website. Leave empty to hide."><input className="input" value={s.announcement} onChange={set('announcement')} /></Field>
            <Field label="About text" className="sm:col-span-2"><textarea className="input" rows={4} value={s.about_text} onChange={set('about_text')} /></Field>
            <Field label="Facebook URL"><input className="input" value={s.social_facebook} onChange={set('social_facebook')} /></Field>
            <Field label="Instagram URL"><input className="input" value={s.social_instagram} onChange={set('social_instagram')} /></Field>
            <Field label="YouTube URL"><input className="input" value={s.social_youtube} onChange={set('social_youtube')} /></Field>
            <Field label="X / Twitter URL"><input className="input" value={s.social_twitter} onChange={set('social_twitter')} /></Field>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="card space-y-4 p-6">
            <Field label="Default minimum stock threshold" hint="A variant/product is marked Low Stock when quantity is at or below this number. Individual products can override it.">
              <input type="number" min="0" className="input max-w-40" value={s.low_stock_threshold} onChange={set('low_stock_threshold')} />
            </Field>
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-navy-800">How stock status is calculated</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><b>Out of Stock</b> — quantity is 0</li>
                <li><b>Low Stock</b> — quantity is between 1 and the threshold</li>
                <li><b>In Stock</b> — quantity is above the threshold</li>
              </ul>
              <p className="mt-2">Status updates automatically whenever stock changes and is shown live on the website.</p>
            </div>
          </div>
        )}

        {tab === 'whatsapp' && (
          <div className="space-y-4">
            <div className={`card flex items-start gap-3 p-4 ${wa.configured ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
              {wa.configured ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="h-5 w-5 shrink-0 text-amber-600" />}
              <div className="text-sm">
                <p className="font-semibold text-navy-800">{wa.configured ? 'WhatsApp Cloud API is configured' : 'WhatsApp Cloud API is not configured yet'}</p>
                <p className="text-slate-600">
                  Token source: <b>{wa.token_source}</b>
                  {wa.last && <> · Last notification: <b>{wa.last.status}</b> on {fmtDate(wa.last.created_at, true)}{wa.last.error && ` — ${wa.last.error}`}</>}
                </p>
              </div>
            </div>

            <div className="card grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Phone Number ID" hint="Meta App → WhatsApp → API Setup"><input className="input font-mono" value={s.wa_phone_number_id} onChange={set('wa_phone_number_id')} /></Field>
              <Field label="WhatsApp Business Account ID"><input className="input font-mono" value={s.wa_business_account_id} onChange={set('wa_business_account_id')} /></Field>
              <Field label="Permanent access token" className="sm:col-span-2" hint={s.wa_access_token_set ? `Saved (${s.wa_access_token_hint}). Leave blank to keep the current token.` : 'Use a System User permanent token. Stored encrypted; never shown again.'}>
                <div className="flex gap-2">
                  <input className="input font-mono" type="password" autoComplete="off" value={s.wa_access_token} onChange={set('wa_access_token')} placeholder={s.wa_access_token_set ? '••••••••••••' : 'EAAG...'} />
                  {s.wa_access_token_set && <button type="button" className="btn-outline shrink-0" onClick={clearToken}>Remove</button>}
                </div>
              </Field>
              <Field label="Graph API version"><input className="input font-mono" value={s.wa_api_version} onChange={set('wa_api_version')} /></Field>
              <div className="flex items-end pb-2"><Toggle checked={s.wa_use_template === 'true'} onChange={setBool('wa_use_template')} label="Send using approved message template" /></div>
              <Field label="Template name"><input className="input font-mono" value={s.wa_template_name} onChange={set('wa_template_name')} disabled={s.wa_use_template !== 'true'} /></Field>
              <Field label="Template language code"><input className="input font-mono" value={s.wa_template_lang} onChange={set('wa_template_lang')} disabled={s.wa_use_template !== 'true'} /></Field>
            </div>

            <div className="card flex gap-3 p-4 text-sm text-slate-600">
              <ShieldCheck className="h-5 w-5 shrink-0 text-navy-800" />
              <div>
                <p>Credentials are stored <b>encrypted on the server</b> and are never sent to the browser. For best security set <code className="rounded bg-slate-100 px-1">WHATSAPP_ACCESS_TOKEN</code> and <code className="rounded bg-slate-100 px-1">WHATSAPP_PHONE_NUMBER_ID</code> as server environment variables — they override these fields.</p>
                <p className="mt-2 flex items-start gap-1"><Info className="mt-0.5 h-4 w-4 shrink-0" /> WhatsApp only allows business-initiated messages through an approved template. Register the template <code className="rounded bg-slate-100 px-1">new_customer_enquiry</code> with 4 body variables (name, mobile, product, message) — see docs/WHATSAPP_SETUP.md.</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="card space-y-5 p-6">
            <Toggle checked={s.notify_whatsapp_enabled === 'true'} onChange={setBool('notify_whatsapp_enabled')} label="Send a WhatsApp notification to the owner for every new enquiry" />
            <Field label="Owner's registered WhatsApp number" hint="Receives enquiry alerts. Include country code, e.g. 919876543210">
              <input className="input max-w-xs" value={s.notify_owner_number} onChange={set('notify_owner_number')} />
            </Field>
            <div className="rounded-lg bg-cream p-4 font-mono text-xs leading-relaxed text-slate-700">
              NEW CUSTOMER ENQUIRY – BAPIN GARMENTS<br /><br />
              Customer Name: Rahul Kumar<br />Mobile: 9876543210<br />Product: Men's Casual Shirt<br />Message: I want to know the price and available sizes.<br /><br />Please contact the customer.
            </div>
            <button type="button" className="btn-whatsapp" onClick={test} disabled={testing || !canWrite}>
              <Send className="h-4 w-4" /> {testing ? 'Sending…' : 'Send test notification'}
            </button>
            <p className="text-xs text-slate-500">Save your changes before sending a test.</p>
          </div>
        )}
      </fieldset>

      {canWrite && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:pl-72">
          <div className="flex justify-end">
            <button className="btn-primary min-w-36" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
