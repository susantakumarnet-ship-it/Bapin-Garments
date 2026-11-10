import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, ChevronRight, MessageSquareText, Ruler, Scissors, Share2, ShieldCheck, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApi } from '../lib/api';
import { useStore } from '../context/StoreContext';
import { absoluteUrl, imgSrc, inr, STOCK, waLink } from '../lib/format';
import { PageLoader, Empty, Modal } from '../components/ui';
import { ProductLabels } from '../components/store/ProductCard';
import { ProductRail } from '../components/store/Section';
import { WhatsAppIcon } from '../components/store/WhatsAppButton';
import EnquiryForm from '../components/store/EnquiryForm';

export default function ProductDetail() {
  const { slug } = useParams();
  const { data, loading, error } = useApi(`/public/products/${slug}`);
  const { settings } = useStore();
  const [imgIdx, setImgIdx] = useState(0);
  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const p = data?.product;

  useEffect(() => {
    if (!p) return;
    document.title = `${p.name} | ${settings.store_name}`;
    setImgIdx(0);
    setSize(null);
    // Default to the first colour that has stock.
    const firstInStock = p.variants.find((v) => v.quantity > 0);
    setColor(firstInStock?.color || p.colors[0]?.name || null);
    return () => {
      document.title = 'Bapin Garments | Your Style, Your Choice!';
    };
  }, [p, settings.store_name]);

  const variantsForColor = useMemo(() => (p ? p.variants.filter((v) => v.color === color) : []), [p, color]);
  const selected = variantsForColor.find((v) => v.size === size);
  const colorStock = variantsForColor.reduce((s, v) => s + v.quantity, 0);

  if (loading) return <PageLoader />;
  if (error || !p)
    return (
      <div className="container-x py-16">
        <Empty title="Product not found" text="This product may have been removed or is no longer available." action={<Link to="/shop" className="btn-primary">Continue shopping</Link>} />
      </div>
    );

  const url = absoluteUrl(`/product/${p.slug}`);
  const statusNow = selected ? selected.stock_status : p.stock_status;
  const st = STOCK[statusNow];
  const waText = [
    `Hello ${settings.store_name}! I'm interested in this product:`,
    '',
    `*${p.name}*`,
    `Code: ${selected?.sku || p.sku}`,
    color ? `Colour: ${color}` : null,
    size ? `Size: ${size}` : null,
    `Price: ${inr(p.price)}`,
    `Link: ${url}`,
    '',
    'Please share availability and details.',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      }
    } catch {
      /* user cancelled */
    }
  };

  const images = p.images.length ? p.images : [{ id: 0, url: null }];

  return (
    <>
      <div className="container-x py-6">
        <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-maroon-700">Home</Link>
          <ChevronRight className="h-3 w-3" />
          {p.parent_category_slug && (
            <>
              <Link to={`/shop/${p.parent_category_slug}`} className="hover:text-maroon-700">{p.parent_category_name}</Link>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <Link to={`/shop/${p.category_slug}`} className="hover:text-maroon-700">{p.category_name}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="line-clamp-1 text-navy-800">{p.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Gallery */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row lg:sticky lg:top-36 lg:self-start">
            {images.length > 1 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto sm:max-h-[600px] sm:flex-col sm:overflow-y-auto">
                {images.map((im, i) => (
                  <button
                    key={im.id}
                    onClick={() => setImgIdx(i)}
                    className={`aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-md ring-2 transition sm:w-20 ${i === imgIdx ? 'ring-maroon-700' : 'ring-transparent opacity-70 hover:opacity-100'}`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={imgSrc(im.url, 200)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div
              className="relative aspect-[3/4] flex-1 cursor-zoom-in overflow-hidden rounded-xl bg-cream"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
              }}
              onMouseLeave={() => setZoom(null)}
            >
              <img
                src={imgSrc(images[imgIdx]?.url, 1200)}
                alt={p.name}
                className="h-full w-full object-cover transition-transform duration-200"
                style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
              <ProductLabels p={p} className="absolute left-3 top-3" />
              {p.discount_percent > 0 && <span className="absolute right-3 top-3 rounded-full bg-maroon-700 px-3 py-1 text-xs font-bold text-white">-{p.discount_percent}% OFF</span>}
            </div>
          </div>

          {/* Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">{p.category_name}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-navy-800 sm:text-4xl">{p.name}</h1>
            <p className="mt-2 text-xs text-slate-500">
              Product Code: <span className="font-mono font-medium text-slate-700">{selected?.sku || p.sku}</span>
            </p>

            <div className="mt-5 flex flex-wrap items-end gap-3 border-y border-slate-100 py-4">
              <span className="text-3xl font-semibold text-navy-900">{inr(p.price)}</span>
              {p.discount_percent > 0 && (
                <>
                  <span className="pb-1 text-lg text-slate-400 line-through">MRP {inr(p.original_price)}</span>
                  <span className="mb-1 rounded bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">{p.discount_percent}% OFF</span>
                </>
              )}
              <span className="w-full text-xs text-slate-400">Inclusive of all taxes</span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
              <span className="font-medium text-navy-800">{st.label}</span>
              <span className="text-slate-500">
                {selected
                  ? selected.quantity > 0
                    ? `· ${selected.quantity} piece${selected.quantity > 1 ? 's' : ''} available in ${size} / ${color}`
                    : `· Not available in ${size} / ${color}`
                  : `· ${p.total_stock} pieces available across all sizes`}
              </span>
            </div>

            {p.colors.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-navy-800">
                  Colour: <span className="font-normal text-slate-600">{color}</span>
                </p>
                <div className="flex flex-wrap gap-3">
                  {p.colors.map((c) => {
                    const stock = p.variants.filter((v) => v.color === c.name).reduce((s, v) => s + v.quantity, 0);
                    return (
                      <button
                        key={c.name}
                        onClick={() => {
                          setColor(c.name);
                          setSize(null);
                        }}
                        title={`${c.name}${stock ? '' : ' (out of stock)'}`}
                        className={`relative h-10 w-10 rounded-full ring-offset-2 transition hover:scale-105 ${color === c.name ? 'ring-2 ring-maroon-700' : 'ring-1 ring-slate-300'} ${stock ? '' : 'opacity-40'}`}
                        style={{ background: c.hex || '#ddd' }}
                        aria-label={c.name}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {p.sizes.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-navy-800">
                    Select Size {size && <span className="font-normal text-slate-600">: {size}</span>}
                  </p>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Ruler className="h-3.5 w-3.5" /> Free alteration in store
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.sizes.map((s) => {
                    const v = variantsForColor.find((x) => x.size === s);
                    const qty = v?.quantity || 0;
                    return (
                      <button
                        key={s}
                        disabled={!v}
                        onClick={() => setSize(size === s ? null : s)}
                        className={`relative min-w-14 rounded-md border px-3 py-2.5 text-sm font-medium transition ${
                          size === s ? 'border-navy-800 bg-navy-800 text-white' : 'border-slate-300 text-navy-800 hover:border-navy-800'
                        } ${!v || qty === 0 ? 'text-slate-400 line-through decoration-slate-400' : ''} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {s}
                        {v?.stock_status === 'low_stock' && (
                          <span className="absolute -right-1 -top-2 rounded bg-amber-500 px-1 text-[9px] font-semibold text-white no-underline">{qty} left</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {color && colorStock === 0 && <p className="mt-2 text-xs text-red-600">This colour is currently out of stock. Enquire to be notified when it's back.</p>}
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href={waLink(settings.whatsapp_number, waText)} target="_blank" rel="noreferrer" className="btn-whatsapp flex-1 py-3.5 text-base">
                <WhatsAppIcon className="h-5 w-5" /> Enquire on WhatsApp
              </a>
              <button onClick={() => setEnquiryOpen(true)} className="btn-navy flex-1 py-3.5 text-base">
                <MessageSquareText className="h-5 w-5" /> Send Enquiry
              </button>
              <button onClick={share} className="btn-outline py-3.5" aria-label="Share product">
                <Share2 className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl bg-cream p-4 text-center text-xs text-slate-600">
              <div className="flex flex-col items-center gap-1"><ShieldCheck className="h-5 w-5 text-maroon-700" /> Quality Assured</div>
              <div className="flex flex-col items-center gap-1"><Scissors className="h-5 w-5 text-maroon-700" /> Free Alteration</div>
              <div className="flex flex-col items-center gap-1"><Store className="h-5 w-5 text-maroon-700" /> Try in Store</div>
            </div>

            <div className="mt-8">
              <h2 className="font-display text-xl font-semibold text-navy-800">Product Details</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.description}</p>
              <dl className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
                {[
                  ['Product Code', p.sku],
                  ['Category', p.parent_category_name ? `${p.parent_category_name} › ${p.category_name}` : p.category_name],
                  ['Material / Fabric', p.fabric || '—'],
                  ['Available Sizes', p.sizes.join(', ') || '—'],
                  ['Available Colours', p.colors.map((c) => c.name).join(', ') || '—'],
                  ['MRP', inr(p.original_price)],
                  ['Offer Price', inr(p.price)],
                  ['Stock Status', `${STOCK[p.stock_status].label} (${p.total_stock} pcs)`],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium text-navy-800">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <BadgeCheck className="h-4 w-4 text-emerald-600" /> Prices and availability are updated live from our store inventory.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ProductRail eyebrow="You may also like" title="Similar Products" to={`/shop/${p.category_slug}`} items={data.related} />

      <Modal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} title="Product Enquiry" size="max-w-xl">
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-cream p-3">
          <img src={imgSrc(images[0]?.url, 120)} alt="" className="h-16 w-12 rounded object-cover" />
          <div className="text-sm">
            <p className="font-medium text-navy-800">{p.name}</p>
            <p className="text-xs text-slate-500">{p.sku} · {inr(p.price)}</p>
          </div>
        </div>
        <EnquiryForm product={{ ...p, name: `${p.name}${color ? ` - ${color}` : ''}${size ? ` / ${size}` : ''}` }} compact />
      </Modal>
    </>
  );
}
