import { Link } from 'react-router-dom';
import { Award, HeartHandshake, Shirt, Sparkles, Users } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const U = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const VALUES = [
  { icon: Shirt, title: 'Wide Collections', text: "From everyday cotton tees to bridal Kanjeevaram silks — men's, women's and kids' wear under one roof." },
  { icon: Award, title: 'Uncompromising Quality', text: 'Every fabric is hand-checked for weave, colour-fastness and finish before it reaches our shelves.' },
  { icon: HeartHandshake, title: 'Warm Customer Service', text: 'Personal styling help, free alterations and quick WhatsApp support — we treat every customer like family.' },
  { icon: Sparkles, title: 'Affordable Fashion', text: 'Latest trends at honest prices, with festive offers throughout the year.' },
];

const STATS = [
  ['20+', 'Years of trust'],
  ['50,000+', 'Happy customers'],
  ['5,000+', 'Styles in store'],
  ['4.8★', 'Average rating'],
];

export default function About() {
  const { settings } = useStore();
  return (
    <>
      <section className="relative overflow-hidden bg-navy-900">
        <img src={U('1441986300917-64674bd600d8', 1800)} alt="Inside Bapin Garments store" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="container-x relative py-20 text-center text-white sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-400">About Us</p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-6xl">The Story of {settings.store_name}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-200">{settings.tagline} — dressing families with love, quality and style.</p>
        </div>
      </section>

      <section className="container-x grid items-center gap-10 py-16 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-4">
          <img src={U('1445205170230-053b83016050', 700)} alt="Clothing racks at our store" className="aspect-[3/4] w-full rounded-xl object-cover shadow-lg" />
          <img src={U('1489987707025-afc232f7ea0f', 700)} alt="Shirts collection" className="mt-10 aspect-[3/4] w-full rounded-xl object-cover shadow-lg" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-600">Who we are</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-navy-800 sm:text-4xl">Fashion for every family, every occasion</h2>
          <div className="mt-3 h-0.5 w-16 bg-gold-400" />
          <p className="mt-5 leading-relaxed text-slate-600">{settings.about_text}</p>
          <p className="mt-4 leading-relaxed text-slate-600">
            Our collections span crisp formal shirts and tailored suits, comfortable denims, vibrant kurtis and salwar suits, handwoven sarees,
            festive and wedding couture, and playful kidswear. Every season we travel to weaving clusters and trusted manufacturers across
            India to bring the best of craftsmanship and contemporary style to our customers.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map(([n, l]) => (
              <div key={l} className="rounded-lg bg-cream p-4 text-center">
                <p className="font-display text-2xl font-semibold text-maroon-700">{n}</p>
                <p className="mt-1 text-xs text-slate-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="container-x">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-600">Our promise</p>
            <h2 className="mt-1 font-display text-3xl font-semibold text-navy-800 sm:text-4xl">Why Shop With Us</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-maroon-50 text-maroon-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-navy-800">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-600">Inside the store</p>
          <h2 className="mt-1 font-display text-3xl font-semibold text-navy-800">A Glimpse of Our Showroom</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {['1441986300917-64674bd600d8', '1490481651871-ab68de25d43d', '1558769132-cb1aea458c5e', '1602810318383-e386cc2a3ccf'].map((id, i) => (
            <img key={id} src={U(id, 600)} alt={`Store photo ${i + 1}`} loading="lazy" className="aspect-square w-full rounded-lg object-cover transition hover:opacity-90" />
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl bg-navy-800 p-8 text-center text-white">
          <Users className="h-8 w-8 text-gold-400" />
          <h3 className="font-display text-2xl">Visit us at {settings.address}</h3>
          <p className="whitespace-pre-line text-sm text-slate-300">{settings.business_hours}</p>
          <Link to="/contact" className="btn-gold mt-2">Get Directions & Contact</Link>
        </div>
      </section>
    </>
  );
}
