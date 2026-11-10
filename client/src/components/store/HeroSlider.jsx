import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1800&q=80`;

const SLIDES = [
  {
    image: U('1617627143750-d86bc21e42bb'),
    eyebrow: 'The Wedding Edit 2026',
    title: 'Drape Yourself in Timeless Elegance',
    text: 'Handpicked Kanjeevaram & Banarasi silks, bridal Anarkalis and more.',
    cta: 'Explore Wedding Collection',
    to: '/shop/wedding-collections',
    align: 'left',
  },
  {
    image: U('1441986300917-64674bd600d8'),
    eyebrow: 'Festive Sale is Live',
    title: 'Flat 20–40% Off on Ethnic & Festive Wear',
    text: 'Celebrate every occasion in style without stretching your budget.',
    cta: 'Shop Offers',
    to: '/offers',
    align: 'left',
  },
  {
    image: U('1617137968427-85924c800a22'),
    eyebrow: "Men's Collection",
    title: 'Sharp Looks for the Modern Man',
    text: 'Suits, shirts, denims and jackets tailored for confidence.',
    cta: 'Shop Men',
    to: '/shop/men',
    align: 'left',
  },
  {
    image: U('1490481651871-ab68de25d43d'),
    eyebrow: 'Just Landed',
    title: 'New Arrivals Every Week',
    text: 'Fresh styles for the whole family — from little ones to grandparents.',
    cta: 'See New Arrivals',
    to: '/new-arrivals',
    align: 'left',
  },
];

export default function HeroSlider() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = SLIDES.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);

  return (
    <section
      className="relative h-[460px] overflow-hidden bg-navy-900 sm:h-[540px] lg:h-[600px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {SLIDES.map((s, idx) => (
        <div
          key={s.title}
          className={`absolute inset-0 transition-opacity duration-1000 ${idx === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          aria-hidden={idx !== i}
        >
          <img
            src={s.image}
            alt=""
            className={`h-full w-full object-cover transition-transform duration-[7000ms] ease-out ${idx === i ? 'scale-105' : 'scale-100'}`}
            loading={idx === 0 ? 'eager' : 'lazy'}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-900/90 via-navy-900/60 to-transparent" />
          <div className="container-x absolute inset-0 flex items-center">
            {idx === i && (
              <div className="max-w-xl text-white">
                <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.3em] text-gold-400 sm:text-sm">{s.eyebrow}</p>
                <h1 className="mt-3 animate-fade-up font-display text-4xl font-semibold leading-tight [animation-delay:120ms] sm:text-5xl lg:text-6xl">
                  {s.title}
                </h1>
                <p className="mt-4 max-w-md animate-fade-up text-sm text-slate-200 [animation-delay:240ms] sm:text-base">{s.text}</p>
                <div className="mt-8 flex animate-fade-up flex-wrap gap-3 [animation-delay:360ms]">
                  <Link to={s.to} className="btn-gold px-6 py-3 text-sm font-semibold uppercase tracking-wider">
                    {s.cta}
                  </Link>
                  <Link to="/contact" className="btn border border-white/40 px-6 py-3 text-sm text-white hover:bg-white hover:text-navy-900">
                    Visit Store
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={() => setI((i - 1 + n) % n)}
        className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/30 md:block"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => setI((i + 1) % n)}
        className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/30 md:block"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((s, idx) => (
          <button
            key={s.title}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-8 bg-gold-400' : 'w-3 bg-white/50 hover:bg-white'}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
