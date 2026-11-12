import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, MapPin, Phone, Quote, Scissors, Star, Tag, Truck } from 'lucide-react';
import { useApi } from '../lib/api';
import { useStore } from '../context/StoreContext';
import { waLink } from '../lib/format';
import HeroSlider from '../components/store/HeroSlider';
import { ProductRail, SectionHeading } from '../components/store/Section';
import { WhatsAppIcon } from '../components/store/WhatsAppButton';

const IMG = (name) => `/images/home/${name}.jpg`;

const PERKS = [
  { icon: BadgeCheck, title: 'Premium Quality', text: 'Handpicked fabrics & finishes' },
  { icon: Tag, title: 'Best Prices', text: 'Affordable fashion, always' },
  { icon: Scissors, title: 'Free Alteration', text: 'Perfect fit, on the house' },
  { icon: Truck, title: 'Easy Enquiry', text: 'Reserve via WhatsApp' },
];

const TESTIMONIALS = [
  { name: 'Sanjana Mohanty', city: 'Bhubaneswar', text: 'Bought my wedding Kanjeevaram from Bapin Garments — the quality and colour were even better than I imagined. The staff were so patient!', rating: 5 },
  { name: 'Rakesh Pradhan', city: 'Cuttack', text: 'Great collection of formal shirts and trousers at honest prices. Free alteration is a big plus. My go-to store now.', rating: 5 },
  { name: 'Ipsita Nayak', city: 'Puri', text: 'I enquired on WhatsApp about kurtis, got photos and sizes within minutes. Picked them up the same evening. Super convenient!', rating: 5 },
  { name: 'Manoj Sahu', city: 'Bhubaneswar', text: 'Shopping for the entire family under one roof — kids party wear, sarees for my mother, jeans for me. Loved it.', rating: 4 },
];

const SHOPPERS = [
  { img: 'shopper-pink', alt: 'Happy shopper with colourful bags', label: 'Shop Women', to: '/shop/women', cover: true },
  { img: 'shopper-illustration', alt: 'Shopper browsing on her phone', label: 'Enquire on WhatsApp', to: '/contact' },
  { img: 'shoppers-duo-illustration', alt: 'Two friends out shopping', label: 'New Arrivals', to: '/new-arrivals' },
  { img: 'shopper-sunglasses', alt: 'Shopper with bags and phone', label: 'Special Offers', to: '/offers' },
];

const SHOP_CATS = [
  { slug: 'men', name: 'Men' },
  { slug: 'women', name: 'Women' },
  { slug: 'kids', name: 'Kids' },
  { slug: 'women-sarees', name: 'Sarees' },
  { slug: 'women-kurtis', name: 'Kurtis' },
  { slug: 'men-jeans', name: 'Jeans' },
  { slug: 'men-shirts', name: 'Shirts' },
  { slug: 'women-dresses', name: 'Dresses' },
];

export default function Home() {
  const { data, loading } = useApi('/public/home');
  const { settings, findCategory } = useStore();

  return (
    <>
      <HeroSlider />

      {/* Perks */}
      <section className="border-b border-slate-100 bg-cream">
        <div className="container-x grid grid-cols-2 gap-4 py-6 lg:grid-cols-4">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-maroon-700 shadow-sm ring-1 ring-gold-100">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-800">{title}</p>
                <p className="text-xs text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Shop by category */}
      <section className="container-x py-14">
        <SectionHeading eyebrow="Explore" title="Shop by Category" center />
        <div className="grid grid-cols-4 gap-x-3 gap-y-6 sm:gap-6 lg:grid-cols-8">
          {SHOP_CATS.map((c) => {
            const cat = findCategory(c.slug);
            return (
              <Link key={c.slug} to={`/shop/${c.slug}`} className="group flex flex-col items-center text-center">
                <div className="relative aspect-square w-full max-w-[120px] overflow-hidden rounded-full bg-cream p-1 ring-2 ring-gold-300 transition group-hover:ring-maroon-700">
                  {cat?.image_url && (
                    <img src={cat.image_url.replace(/w=\d+/, 'w=300')} alt={c.name} loading="lazy" className="h-full w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  )}
                </div>
                <span className="mt-2 text-xs font-medium text-navy-800 group-hover:text-maroon-700 sm:text-sm">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured collections */}
      <section className="container-x pb-6">
        <SectionHeading eyebrow="Curated for you" title="Featured Collections" center />
        <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2 md:[height:560px]">
          <CollectionTile className="md:row-span-2" to="/shop/wedding-collections" img={IMG('store-fabrics-mannequin')} eyebrow="Shaadi Season" title="Wedding Collection" text="Bridal silks, Anarkalis & sherwanis" />
          <CollectionTile to="/shop/festival-collections" img={IMG('fabric-wall')} eyebrow="Celebrate in style" title="Festival Collection" />
          <CollectionTile to="/shop/men-formal-wear" img={IMG('boxed-shirts')} eyebrow="Suit up" title="Men's Formal Wear" />
          <CollectionTile className="md:col-span-2" to="/shop/seasonal-collections" img={IMG('shopper-floral')} position="center 25%" eyebrow="Winter 2026" title="Seasonal Collection" text="Cosy knits, cardigans & sweatshirts" />
        </div>
      </section>

      <ProductRail eyebrow="Just In" title="Latest Arrivals" to="/new-arrivals" items={data?.latest} loading={loading} />

      {/* Offer banner */}
      <section className="container-x py-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-maroon-800 via-maroon-700 to-navy-800 px-6 py-10 text-white sm:px-12">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full border-[24px] border-gold-400/20" />
          <div className="absolute -bottom-16 right-40 h-40 w-40 rounded-full bg-gold-400/10" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">Limited Time Offer</p>
              <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
                Up to <span className="text-gold-400">40% OFF</span> on Festive Favourites
              </h2>
              <p className="mt-2 text-sm text-white/80">Sarees, kurtis, suits & more. Visit the store or reserve on WhatsApp today.</p>
            </div>
            <Link to="/offers" className="btn-gold shrink-0 px-8 py-3 font-semibold uppercase tracking-wider">
              Grab the Deals
            </Link>
          </div>
        </div>
      </section>

      {/* Happy shoppers */}
      <section className="container-x py-10">
        <SectionHeading eyebrow="Shopping made joyful" title="Happy Shoppers" center />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SHOPPERS.map((s) => (
            <Link key={s.img} to={s.to} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-md">
              <div className="aspect-square overflow-hidden">
                <img src={IMG(s.img)} alt={s.alt} loading="lazy" className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${s.cover ? 'object-cover' : 'object-contain p-2'}`} />
              </div>
              <p className="border-t border-slate-100 px-4 py-3 text-center text-sm font-semibold text-navy-800 group-hover:text-maroon-700">{s.label} →</p>
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow="Save big" title="Special Offers & Discounts" to="/offers" items={data?.offers} loading={loading} />
      <ProductRail eyebrow="Hot right now" title="Trending Garments" to="/shop?tag=trending" items={data?.trending} loading={loading} className="bg-gradient-to-b from-white to-cream/60" />
      <ProductRail eyebrow="Customer favourites" title="Best Sellers" to="/shop?tag=bestseller" items={data?.bestSellers} loading={loading} />
      <ProductRail eyebrow="Handpicked" title="Featured Products" to="/shop?tag=featured" items={data?.featured} loading={loading} />

      {/* Testimonials */}
      <section className="mt-6 bg-navy-800 py-16 text-white">
        <div className="container-x">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">Testimonials</p>
            <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">What Our Customers Say</h2>
            <div className="mx-auto mt-3 h-0.5 w-16 bg-gold-400" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="relative rounded-xl bg-white/5 p-6 ring-1 ring-white/10 transition hover:-translate-y-1 hover:bg-white/10">
                <Quote className="h-8 w-8 text-gold-400/60" />
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < t.rating ? 'fill-gold-400 text-gold-400' : 'text-white/20'}`} />
                  ))}
                </div>
                <blockquote className="mt-3 text-sm leading-relaxed text-slate-200">“{t.text}”</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-white">{t.name}</span>
                  <span className="text-slate-400"> · {t.city}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Store location */}
      <section className="container-x pt-16">
        <SectionHeading eyebrow="Come say hello" title="Visit Our Store" center />
        <div className="grid overflow-hidden rounded-2xl border border-slate-200 shadow-sm lg:grid-cols-5">
          <div className="space-y-5 bg-cream p-8 lg:col-span-2">
            <h3 className="font-display text-2xl text-navy-800">{settings.store_name}</h3>
            <Info icon={MapPin} title="Address">{settings.address}</Info>
            <Info icon={Phone} title="Call us"><a href={`tel:${settings.phone}`} className="hover:text-maroon-700">{settings.phone}</a></Info>
            <Info icon={Clock} title="Business Hours"><span className="whitespace-pre-line">{settings.business_hours}</span></Info>
            <div className="flex flex-wrap gap-3 pt-2">
              <a href={waLink(settings.whatsapp_number, `Hello ${settings.store_name}, I'd like to visit your store.`)} target="_blank" rel="noreferrer" className="btn-whatsapp">
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp
              </a>
              {settings.map_link && (
                <a href={settings.map_link} target="_blank" rel="noreferrer" className="btn-navy">
                  <MapPin className="h-4 w-4" /> Get Directions
                </a>
              )}
            </div>
          </div>
          <div className="min-h-[320px] lg:col-span-3">
            {settings.map_embed_url && (
              <iframe title="Store location" src={settings.map_embed_url} className="h-full min-h-[320px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function CollectionTile({ to, img, eyebrow, title, text, position, className = '' }) {
  return (
    <Link to={to} className={`group relative block min-h-[220px] overflow-hidden rounded-xl ${className}`}>
      <img src={img} alt={title} loading="lazy" style={position ? { objectPosition: position } : undefined} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold-300">{eyebrow}</p>
        <h3 className="mt-1 font-display text-2xl font-semibold">{title}</h3>
        {text && <p className="mt-1 text-sm text-white/80">{text}</p>}
        <span className="mt-3 inline-block border-b border-gold-400 pb-0.5 text-xs font-semibold uppercase tracking-wider text-gold-300 transition group-hover:text-white">
          Shop Now →
        </span>
      </div>
    </Link>
  );
}

function Info({ icon: Icon, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-maroon-700 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm text-slate-600">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-800">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
