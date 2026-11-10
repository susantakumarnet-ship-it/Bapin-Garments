import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { Field } from '../ui';

const EMPTY = { name: '', mobile: '', email: '', subject: '', product_name: '', message: '', consent: true, website: '' };

/**
 * Customer contact / feedback form. Saves the enquiry via the API, which
 * then notifies the store owner on WhatsApp from the server.
 */
export default function EnquiryForm({ product, compact = false, onSubmitted }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    subject: product ? `Enquiry about ${product.name}` : '',
    product_name: product ? `${product.name} (${product.sku})` : '',
  }));
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Please enter your name';
    if (!/^(\+?91[\s-]?)?[6-9]\d{9}$/.test(form.mobile.replace(/[\s-]/g, ''))) e.mobile = 'Enter a valid 10-digit mobile number';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.subject.trim().length < 2) e.subject = 'Please enter a subject';
    if (form.message.trim().length < 5) e.message = 'Please write a short message';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSending(true);
    try {
      const res = await api('/public/enquiries', {
        method: 'POST',
        body: { ...form, product_id: product?.id, source: product ? 'product_page' : 'contact_form' },
      });
      setDone(res.message);
      setForm({ ...EMPTY, subject: form.subject, product_name: form.product_name });
      onSubmitted?.();
    } catch (err) {
      setErrors(err.fields || { _: err.message });
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center rounded-xl bg-emerald-50 p-8 text-center ring-1 ring-emerald-100">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <h3 className="mt-3 font-display text-2xl text-navy-800">Enquiry Submitted!</h3>
        <p className="mt-2 max-w-sm text-sm text-slate-600">{done}</p>
        <button className="btn-outline mt-5" onClick={() => setDone(null)}>
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <Field label="Your Name *" error={errors.name}>
          <input className="input" value={form.name} onChange={set('name')} autoComplete="name" maxLength={120} />
        </Field>
        <Field label="Mobile Number *" error={errors.mobile}>
          <input className="input" value={form.mobile} onChange={set('mobile')} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" maxLength={16} />
        </Field>
        <Field label="Email (optional)" error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={160} />
        </Field>
        <Field label="Subject *" error={errors.subject}>
          <input className="input" value={form.subject} onChange={set('subject')} maxLength={200} />
        </Field>
      </div>
      <Field label="Product Interested In" error={errors.product_name}>
        <input className="input" value={form.product_name} onChange={set('product_name')} placeholder="e.g. Men's casual shirt, Banarasi saree" maxLength={200} readOnly={Boolean(product)} />
      </Field>
      <Field label="Message / Enquiry *" error={errors.message}>
        <textarea className="input min-h-28" value={form.message} onChange={set('message')} maxLength={2000} placeholder="Tell us the size, colour or details you're looking for..." />
      </Field>
      {/* Honeypot — hidden from humans */}
      <input type="text" name="website" value={form.website} onChange={set('website')} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="flex items-start gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={form.consent} onChange={set('consent')} className="mt-0.5 accent-maroon-700" />
        I agree to be contacted by Bapin Garments on phone / WhatsApp regarding my enquiry.
      </label>
      {errors._ && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{errors._}</p>}
      <button type="submit" disabled={sending} className="btn-primary w-full py-3 sm:w-auto sm:px-8">
        <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Submit Enquiry'}
      </button>
    </form>
  );
}
