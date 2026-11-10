import { Link } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { waLink } from '../../lib/format';
import Logo from './Logo';
import { WhatsAppIcon } from './WhatsAppButton';

const Social = {
  facebook: (
    <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
  ),
  instagram: (
    <path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21 8.1c-.1-1.5-.4-2.8-1.5-3.9S17.1 2.8 15.6 2.7C14.1 2.6 9.9 2.6 8.4 2.7 6.9 2.8 5.6 3.1 4.5 4.2S3.1 6.6 3 8.1c-.1 1.5-.1 5.7 0 7.2.1 1.5.4 2.8 1.5 3.9s2.4 1.4 3.9 1.5c1.5.1 5.7.1 7.2 0 1.5-.1 2.8-.4 3.9-1.5s1.4-2.4 1.5-3.9c.1-1.5.1-5.7 0-7.2Zm-2 9a3 3 0 0 1-1.7 1.7c-1.2.5-4 .4-5.3.4s-4.1.1-5.3-.4A3 3 0 0 1 5 17.1c-.5-1.2-.4-4-.4-5.3s-.1-4.1.4-5.3A3 3 0 0 1 6.7 4.8c1.2-.5 4-.4 5.3-.4s4.1-.1 5.3.4A3 3 0 0 1 19 6.5c.5 1.2.4 4 .4 5.3s.1 4.1-.4 5.3Z" />
  ),
  youtube: (
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
  ),
  twitter: (
    <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5Z" />
  ),
};

export default function Footer() {
  const { settings, categories } = useStore();
  const socials = ['facebook', 'instagram', 'youtube', 'twitter'].filter((k) => settings[`social_${k}`]);
  const shop = categories.filter((c) => ['men', 'women', 'kids'].includes(c.slug));

  return (
    <footer className="mt-16 bg-navy-900 text-slate-300">
      <div className="border-b border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-4 py-8 text-center md:flex-row md:text-left">
          <div>
            <h3 className="font-display text-2xl text-white">Have a question about a product?</h3>
            <p className="mt-1 text-sm text-slate-400">Message us on WhatsApp for prices, sizes and availability — we reply fast!</p>
          </div>
          <a href={waLink(settings.whatsapp_number, `Hello ${settings.store_name}, I have an enquiry.`)} target="_blank" rel="noreferrer" className="btn-whatsapp px-6 py-3">
            <WhatsAppIcon className="h-5 w-5" /> WhatsApp Us
          </a>
        </div>
      </div>

      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-slate-400">{settings.about_text?.slice(0, 170)}…</p>
          <div className="mt-5 flex gap-2">
            {socials.map((k) => (
              <a
                key={k}
                href={settings[`social_${k}`]}
                target="_blank"
                rel="noreferrer"
                aria-label={k}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-gold-400 hover:text-navy-900"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  {Social[k]}
                </svg>
              </a>
            ))}
            <a
              href={waLink(settings.whatsapp_number)}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-[#25D366]"
            >
              <WhatsAppIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-400">Shop</h4>
          <ul className="space-y-2 text-sm">
            {shop.map((c) => (
              <li key={c.slug}>
                <Link to={`/shop/${c.slug}`} className="hover:text-gold-300">
                  {c.name}'s Collection
                </Link>
              </li>
            ))}
            <li><Link to="/new-arrivals" className="hover:text-gold-300">New Arrivals</Link></li>
            <li><Link to="/offers" className="hover:text-gold-300">Offers & Discounts</Link></li>
            <li><Link to="/shop/wedding-collections" className="hover:text-gold-300">Wedding Collection</Link></li>
            <li><Link to="/shop/festival-collections" className="hover:text-gold-300">Festival Collection</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-400">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/about" className="hover:text-gold-300">About Us</Link></li>
            <li><Link to="/contact" className="hover:text-gold-300">Contact Us</Link></li>
            <li><Link to="/shop" className="hover:text-gold-300">All Products</Link></li>
            <li><Link to="/admin/login" className="hover:text-gold-300">Admin Login</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-400">Visit Our Store</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3"><MapPin className="h-4 w-4 shrink-0 text-gold-400" /> {settings.address}</li>
            <li className="flex gap-3"><Phone className="h-4 w-4 shrink-0 text-gold-400" /> <a href={`tel:${settings.phone}`}>{settings.phone}</a></li>
            <li className="flex gap-3"><Mail className="h-4 w-4 shrink-0 text-gold-400" /> <a href={`mailto:${settings.email}`}>{settings.email}</a></li>
            <li className="flex gap-3"><Clock className="h-4 w-4 shrink-0 text-gold-400" /> <span className="whitespace-pre-line">{settings.business_hours}</span></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {settings.store_name}. All rights reserved. • {settings.tagline}
      </div>
    </footer>
  );
}
