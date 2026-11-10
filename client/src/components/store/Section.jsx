import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ProductCard, { ProductCardSkeleton } from './ProductCard';

export function SectionHeading({ eyebrow, title, subtitle, to, center = false }) {
  return (
    <div className={`mb-8 flex flex-col gap-2 ${center ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'}`}>
      <div className={center ? 'max-w-2xl' : ''}>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-600">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-3xl font-semibold text-navy-800 sm:text-4xl">{title}</h2>
        {center && <div className="mx-auto mt-3 h-0.5 w-16 bg-gold-400" />}
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {to && !center && (
        <Link to={to} className="group inline-flex items-center gap-1 text-sm font-semibold text-maroon-700 hover:text-maroon-800">
          View All <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export function ProductRail({ eyebrow, title, subtitle, to, items, loading, className = '' }) {
  if (!loading && !items?.length) return null;
  return (
    <section className={`container-x py-12 ${className}`}>
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} to={to} />
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[46%] shrink-0 snap-start sm:w-auto">
                <ProductCardSkeleton />
              </div>
            ))
          : items.slice(0, 8).map((p) => (
              <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
                <ProductCard p={p} />
              </div>
            ))}
      </div>
    </section>
  );
}
