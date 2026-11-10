import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { imgSrc, inr, waLink, absoluteUrl } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { WhatsAppIcon } from './WhatsAppButton';

export function ProductLabels({ p, className = '' }) {
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      {p.is_new_arrival && <span className="rounded-sm bg-navy-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">New</span>}
      {p.is_best_seller && <span className="rounded-sm bg-gold-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-900">Best Seller</span>}
      {p.is_featured && !p.is_best_seller && <span className="rounded-sm bg-maroon-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Featured</span>}
      {p.is_trending && !p.is_new_arrival && !p.is_best_seller && !p.is_featured && (
        <span className="rounded-sm bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-maroon-700 ring-1 ring-maroon-100">Trending</span>
      )}
    </div>
  );
}

export default function ProductCard({ p }) {
  const { settings } = useStore();
  const out = p.stock_status === 'out_of_stock';
  const low = p.stock_status === 'low_stock';
  const enquiry = `Hello ${settings.store_name}, I'm interested in:\n*${p.name}* (${p.sku})\nPrice: ${inr(p.price)}\n${absoluteUrl(`/product/${p.slug}`)}\n\nPlease share availability.`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg bg-white transition-shadow duration-300 hover:shadow-xl">
      <Link to={`/product/${p.slug}`} className="relative block aspect-[3/4] overflow-hidden bg-cream">
        <img
          src={imgSrc(p.image, 600)}
          alt={p.name}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-105 ${p.image2 ? 'group-hover:opacity-0' : ''}`}
        />
        {p.image2 && (
          <img src={imgSrc(p.image2, 600)} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition-all duration-700 group-hover:scale-100 group-hover:opacity-100" />
        )}
        <ProductLabels p={p} className="absolute left-2 top-2" />
        {p.discount_percent > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-maroon-700 px-2 py-1 text-[11px] font-bold text-white shadow">-{p.discount_percent}%</span>
        )}
        {out && (
          <div className="absolute inset-0 grid place-items-center bg-white/60">
            <span className="rounded bg-navy-900/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">Out of Stock</span>
          </div>
        )}
        <div className="absolute inset-x-2 bottom-2 flex translate-y-4 gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded bg-white/95 py-2 text-xs font-semibold text-navy-800 shadow">
            <Eye className="h-3.5 w-3.5" /> View
          </span>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-gold-600">{p.category_name}</p>
        <Link to={`/product/${p.slug}`} className="mt-0.5 line-clamp-1 text-sm font-medium text-navy-800 hover:text-maroon-700" title={p.name}>
          {p.name}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold text-navy-900">{inr(p.price)}</span>
          {p.discount_percent > 0 && (
            <>
              <span className="text-xs text-slate-400 line-through">{inr(p.original_price)}</span>
              <span className="text-xs font-semibold text-emerald-600">{p.discount_percent}% off</span>
            </>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex -space-x-1">
            {p.colors?.slice(0, 5).map((c) => (
              <span key={c.name} title={c.name} className="h-4 w-4 rounded-full ring-2 ring-white" style={{ background: c.hex || '#ccc', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />
            ))}
          </div>
          {low && <span className="text-[11px] font-medium text-amber-600">Only few left!</span>}
        </div>
        <a
          href={waLink(settings.whatsapp_number, enquiry)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded border border-[#25D366]/40 py-1.5 text-xs font-medium text-[#128C7E] transition hover:bg-[#25D366] hover:text-white"
        >
          <WhatsAppIcon className="h-3.5 w-3.5" /> Enquire on WhatsApp
        </a>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg">
      <div className="aspect-[3/4] bg-slate-100" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-1/3 rounded bg-slate-100" />
        <div className="h-4 w-3/4 rounded bg-slate-100" />
        <div className="h-4 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  );
}
