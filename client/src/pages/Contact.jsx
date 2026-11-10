import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { waLink } from '../lib/format';
import EnquiryForm from '../components/store/EnquiryForm';
import { WhatsAppIcon } from '../components/store/WhatsAppButton';

export default function Contact() {
  const { settings } = useStore();
  const cards = [
    { icon: MapPin, title: 'Store Address', body: settings.address, href: settings.map_link, cta: 'Get directions' },
    { icon: Phone, title: 'Call Us', body: settings.phone, href: `tel:${settings.phone}`, cta: 'Call now' },
    { icon: WhatsAppIcon, title: 'WhatsApp', body: `+${settings.whatsapp_number}`, href: waLink(settings.whatsapp_number, `Hello ${settings.store_name}, I have an enquiry.`), cta: 'Start chat' },
    { icon: Mail, title: 'Email', body: settings.email, href: `mailto:${settings.email}`, cta: 'Send email' },
  ];

  return (
    <>
      <section className="bg-navy-800">
        <div className="container-x py-14 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-400">Contact Us</p>
          <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">We'd Love to Hear From You</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">Questions about a product, sizes, bulk orders or alterations? Send us a message and our team will get back to you quickly.</p>
        </div>
      </section>

      <section className="container-x -mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, title, body, href, cta }) => (
          <a key={title} href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="card group p-5 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-maroon-50 text-maroon-700 transition group-hover:bg-maroon-700 group-hover:text-white">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-navy-800">{title}</h3>
            <p className="mt-1 break-words text-sm text-slate-600">{body}</p>
            <span className="mt-2 inline-block text-xs font-semibold text-maroon-700">{cta} →</span>
          </a>
        ))}
      </section>

      <section className="container-x grid gap-10 py-14 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="font-display text-3xl font-semibold text-navy-800">Send us an Enquiry</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Fields marked * are required. We usually respond within a few hours during business hours.</p>
          <div className="card p-6">
            <EnquiryForm />
          </div>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <div className="card overflow-hidden">
            {settings.map_embed_url && (
              <iframe title="Bapin Garments location" src={settings.map_embed_url} className="h-72 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            )}
            <div className="p-5">
              <h3 className="font-display text-xl text-navy-800">{settings.store_name}</h3>
              <p className="mt-1 flex gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700" />{settings.address}</p>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-navy-800"><Clock className="h-5 w-5 text-maroon-700" /> Business Hours</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{settings.business_hours}</p>
          </div>
        </div>
      </section>
    </>
  );
}
