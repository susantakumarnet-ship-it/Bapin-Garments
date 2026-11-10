import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { useApi, qs } from '../lib/api';
import { useStore } from '../context/StoreContext';
import ProductCard, { ProductCardSkeleton } from '../components/store/ProductCard';
import { Empty, ErrorBox, Pagination } from '../components/ui';

const SORTS = [
  ['newest', 'Newest First'],
  ['popular', 'Popularity'],
  ['price_asc', 'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
  ['discount', 'Better Discount'],
];

const PRICE_BANDS = [
  ['', '', 'Any price'],
  ['', '999', 'Under ₹999'],
  ['1000', '1999', '₹1,000 – ₹1,999'],
  ['2000', '4999', '₹2,000 – ₹4,999'],
  ['5000', '', '₹5,000 & above'],
];

const TAG_TITLES = { new: 'New Arrivals', offers: 'Offers & Discounts', trending: 'Trending Now', bestseller: 'Best Sellers', featured: 'Featured Products' };

export default function Shop({ preset }) {
  const { categorySlug } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { categories, findCategory } = useStore();
  const [drawer, setDrawer] = useState(false);

  const tag = preset || params.get('tag') || '';
  const q = location.pathname === '/search' ? params.get('q') || '' : params.get('q') || '';
  const filters = {
    category: categorySlug || '',
    q,
    tag,
    size: params.get('size') || '',
    color: params.get('color') || '',
    min_price: params.get('min_price') || '',
    max_price: params.get('max_price') || '',
    in_stock: params.get('in_stock') || '',
    sort: params.get('sort') || (tag === 'offers' ? 'discount' : 'newest'),
    page: params.get('page') || '1',
    limit: 24,
  };

  const { data, loading, error, reload } = useApi(`/public/products${qs(filters)}`);
  const { data: facets } = useApi('/public/filters');

  const cat = categorySlug ? findCategory(categorySlug) : null;
  const title = q ? `Search results for “${q}”` : cat ? cat.name : TAG_TITLES[tag] || 'All Products';
  const subCats = cat ? (cat.children?.length ? cat.children : cat.parent?.children || []) : categories;

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v === null || v === undefined) next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const activeChips = useMemo(() => {
    const chips = [];
    if (filters.size) chips.push(['size', `Size: ${filters.size}`]);
    if (filters.color) chips.push(['color', `Colour: ${filters.color}`]);
    if (filters.min_price || filters.max_price) chips.push(['price', `₹${filters.min_price || 0} – ${filters.max_price ? `₹${filters.max_price}` : 'above'}`]);
    if (filters.in_stock) chips.push(['in_stock', 'In stock only']);
    return chips;
  }, [filters.size, filters.color, filters.min_price, filters.max_price, filters.in_stock]);

  const clearChip = (k) => (k === 'price' ? update({ min_price: '', max_price: '' }) : update({ [k]: '' }));

  const FilterPanel = (
    <div className="space-y-7">
      {subCats.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy-800">Categories</h4>
          <ul className="space-y-1.5 text-sm">
            {subCats.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/shop/${c.slug}${tag && !preset ? `?tag=${tag}` : ''}`}
                  className={`flex items-center justify-between rounded px-2 py-1 transition hover:bg-cream hover:text-maroon-700 ${c.slug === categorySlug ? 'bg-cream font-semibold text-maroon-700' : 'text-slate-600'}`}
                >
                  {c.name}
                  <span className="text-xs text-slate-400">{c.total_count ?? c.product_count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {facets?.sizes?.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy-800">Size</h4>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button
                key={s}
                onClick={() => update({ size: filters.size === s ? '' : s })}
                className={`min-w-10 rounded border px-2.5 py-1.5 text-xs font-medium transition ${filters.size === s ? 'border-navy-800 bg-navy-800 text-white' : 'border-slate-200 text-slate-600 hover:border-navy-800'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {facets?.colors?.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy-800">Colour</h4>
          <div className="flex flex-wrap gap-2.5">
            {facets.colors.map((c) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => update({ color: filters.color === c.name ? '' : c.name })}
                className={`h-7 w-7 rounded-full ring-offset-2 transition hover:scale-110 ${filters.color === c.name ? 'ring-2 ring-maroon-700' : 'ring-1 ring-slate-200'}`}
                style={{ background: c.hex || '#ddd' }}
                aria-label={c.name}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy-800">Price</h4>
        <div className="space-y-1.5 text-sm">
          {PRICE_BANDS.map(([min, max, label]) => (
            <label key={label} className="flex cursor-pointer items-center gap-2 text-slate-600">
              <input
                type="radio"
                name="price"
                className="accent-maroon-700"
                checked={filters.min_price === min && filters.max_price === max}
                onChange={() => update({ min_price: min, max_price: max })}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" className="accent-maroon-700" checked={filters.in_stock === 'true'} onChange={(e) => update({ in_stock: e.target.checked ? 'true' : '' })} />
        Show in-stock items only
      </label>
    </div>
  );

  return (
    <div>
      {/* Page banner */}
      <section className="relative overflow-hidden bg-navy-800">
        {cat?.image_url && <img src={cat.image_url.replace(/w=\d+/, 'w=1600')} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
        <div className="container-x relative py-10 text-white sm:py-14">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-300" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-300">Home</Link>
            <ChevronRight className="h-3 w-3" />
            {cat?.parent && (
              <>
                <Link to={`/shop/${cat.parent.slug}`} className="hover:text-gold-300">{cat.parent.name}</Link>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span className="text-gold-300">{cat ? cat.name : TAG_TITLES[tag] || (q ? 'Search' : 'Shop')}</span>
          </nav>
          <h1 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">{title}</h1>
          {cat?.description && <p className="mt-2 max-w-xl text-sm text-slate-300">{cat.description}</p>}
        </div>
      </section>

      <div className="container-x grid gap-8 py-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-36">{FilterPanel}</div>
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{loading ? 'Loading…' : `${data?.total || 0} products`}</p>
            <div className="flex items-center gap-2">
              <button className="btn-outline btn-sm lg:hidden" onClick={() => setDrawer(true)}>
                <SlidersHorizontal className="h-4 w-4" /> Filters {activeChips.length > 0 && `(${activeChips.length})`}
              </button>
              <select className="input w-auto py-1.5 text-sm" value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort products">
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    Sort: {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {activeChips.map(([k, label]) => (
                <button key={k} onClick={() => clearChip(k)} className="flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-medium text-navy-800 ring-1 ring-gold-300 hover:bg-gold-100">
                  {label} <X className="h-3 w-3" />
                </button>
              ))}
              <button onClick={() => update({ size: '', color: '', min_price: '', max_price: '', in_stock: '' })} className="text-xs font-semibold text-maroon-700 underline">
                Clear all
              </button>
            </div>
          )}

          <ErrorBox error={error} onRetry={reload} />

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : data?.items?.length ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {data.items.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
              <Pagination
                page={data.page}
                pages={data.pages}
                onChange={(page) => {
                  update({ page: String(page) });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          ) : (
            !error && (
              <Empty
                title="No products found"
                text="Try removing some filters or searching with a different word. You can also ask us on WhatsApp — we may have it in store!"
                action={<Link to="/shop" className="btn-primary">Browse all products</Link>}
              />
            )
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-900/50" onClick={() => setDrawer(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] animate-fade-up overflow-y-auto rounded-t-2xl bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-xl text-navy-800">Filters</h3>
              <button onClick={() => setDrawer(false)} aria-label="Close filters">
                <X className="h-5 w-5" />
              </button>
            </div>
            {FilterPanel}
            <button className="btn-primary mt-6 w-full" onClick={() => setDrawer(false)}>
              Show {data?.total || 0} products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
