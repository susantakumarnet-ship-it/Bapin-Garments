import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, MapPin, Phone, Search, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { waLink } from '../../lib/format';
import Logo from './Logo';
import { WhatsAppIcon } from './WhatsAppButton';

const NAV = [
  { label: 'Home', to: '/' },
  { label: 'Men', to: '/shop/men', slug: 'men' },
  { label: 'Women', to: '/shop/women', slug: 'women' },
  { label: 'Kids', to: '/shop/kids', slug: 'kids' },
  { label: 'New Arrivals', to: '/new-arrivals' },
  { label: 'Offers', to: '/offers', highlight: true },
  { label: 'About Us', to: '/about' },
  { label: 'Contact Us', to: '/contact' },
];

function SearchBox({ onDone, autoFocus }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    navigate(`/search?q=${encodeURIComponent(term)}`);
    onDone?.();
  };
  return (
    <form onSubmit={submit} className="relative w-full" role="search">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search for shirts, sarees, kurtis, jeans..."
        className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-24 text-sm transition focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-100"
        aria-label="Search products"
      />
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-navy-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-maroon-700">
        Search
      </button>
    </form>
  );
}

export default function Header() {
  const { settings, categories } = useStore();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  const childrenOf = (slug) => categories.find((c) => c.slug === slug)?.children || [];
  const collections = childrenOf('collections');

  return (
    <>
      {/* Announcement bar */}
      {settings.announcement && (
        <div className="overflow-hidden bg-navy-800 text-xs text-gold-100">
          <div className="flex w-max animate-marquee gap-16 whitespace-nowrap py-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex items-center gap-16">
                <span>✦ {settings.announcement}</span>
                <span>✦ WhatsApp us for instant product enquiries</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 bg-white/95 backdrop-blur transition-shadow ${scrolled ? 'shadow-md' : 'border-b border-slate-100'}`}>
        <div className="container-x flex items-center gap-4 py-3 lg:gap-8">
          <button className="rounded-md p-2 text-navy-800 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <Logo className="mr-auto lg:mr-0" tagline={!scrolled} />
          <div className="hidden flex-1 md:block">
            <SearchBox />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <a href={`tel:${settings.phone}`} className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-navy-800 hover:bg-slate-100 xl:flex">
              <Phone className="h-4 w-4 text-maroon-700" /> {settings.phone}
            </a>
            <a
              href={waLink(settings.whatsapp_number, `Hello ${settings.store_name}, I have an enquiry.`)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full bg-[#25D366] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1ebe5b]"
            >
              <WhatsAppIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </a>
          </div>
        </div>
        <div className="container-x pb-3 md:hidden">
          <SearchBox />
        </div>

        {/* Desktop nav */}
        <nav className="hidden border-t border-slate-100 lg:block" aria-label="Main">
          <ul className="container-x flex items-center justify-center gap-1">
            {NAV.map((item) => {
              const subs = item.slug ? childrenOf(item.slug) : [];
              return (
                <li key={item.to} className="group relative">
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-1 px-4 py-3 text-[13px] font-medium uppercase tracking-wider transition-colors ${
                        item.highlight ? 'text-maroon-700' : isActive ? 'text-maroon-700' : 'text-navy-800 hover:text-maroon-700'
                      }`
                    }
                  >
                    {item.label}
                    {subs.length > 0 && <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />}
                    {item.highlight && <span className="ml-1 rounded bg-maroon-700 px-1.5 py-0.5 text-[9px] text-white">SALE</span>}
                  </NavLink>
                  {subs.length > 0 && (
                    <div className="invisible absolute left-1/2 top-full z-50 w-[560px] -translate-x-1/2 translate-y-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                      <div className="grid grid-cols-[1fr_200px] gap-6 rounded-b-xl border border-slate-100 bg-white p-6 shadow-xl">
                        <div>
                          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600">Shop {item.label}</p>
                          <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
                            {subs.map((s) => (
                              <li key={s.slug}>
                                <Link to={`/shop/${s.slug}`} className="text-sm text-slate-600 transition hover:pl-1 hover:text-maroon-700">
                                  {s.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                          <Link to={item.to} className="mt-4 inline-block text-sm font-semibold text-navy-800 hover:text-maroon-700">
                            View all {item.label} →
                          </Link>
                        </div>
                        <div className="overflow-hidden rounded-lg">
                          <img
                            src={categories.find((c) => c.slug === item.slug)?.image_url}
                            alt={item.label}
                            className="h-full w-full object-cover transition-transform duration-700 hover:scale-110"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {collections.length > 0 && (
              <li className="group relative">
                <span className="flex cursor-default items-center gap-1 px-4 py-3 text-[13px] font-medium uppercase tracking-wider text-navy-800">
                  Collections <ChevronDown className="h-3.5 w-3.5" />
                </span>
                <div className="invisible absolute right-0 top-full z-50 w-56 translate-y-2 rounded-b-xl border border-slate-100 bg-white p-3 opacity-0 shadow-xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  {collections.map((c) => (
                    <Link key={c.slug} to={`/shop/${c.slug}`} className="block rounded px-3 py-2 text-sm text-slate-600 hover:bg-cream hover:text-maroon-700">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </li>
            )}
          </ul>
        </nav>
      </header>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-navy-900/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <aside className={`absolute left-0 top-0 flex h-full w-[85%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <Logo tagline={false} />
            <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-slate-100" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            {[...NAV, ...(collections.length ? [{ label: 'Collections', slug: 'collections', to: '/shop/collections' }] : [])].map((item) => {
              const subs = item.slug ? childrenOf(item.slug) : [];
              const isOpen = expanded === item.label;
              return (
                <div key={item.label} className="border-b border-slate-50">
                  <div className="flex items-center">
                    <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `flex-1 px-3 py-3 text-sm font-medium ${isActive ? 'text-maroon-700' : 'text-navy-800'}`}>
                      {item.label}
                    </NavLink>
                    {subs.length > 0 && (
                      <button className="p-3" onClick={() => setExpanded(isOpen ? null : item.label)} aria-label={`Expand ${item.label}`}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-1 bg-cream px-3 py-2">
                      {subs.map((s) => (
                        <Link key={s.slug} to={`/shop/${s.slug}`} className="rounded px-2 py-1.5 text-sm text-slate-600">
                          {s.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="space-y-2 border-t border-slate-100 p-4 text-sm text-slate-600">
            <a href={`tel:${settings.phone}`} className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-maroon-700" /> {settings.phone}
            </a>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700" /> {settings.address}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
