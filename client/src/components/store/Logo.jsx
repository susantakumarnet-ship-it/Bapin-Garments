import { Link } from 'react-router-dom';

export default function Logo({ light = false, tagline = true, className = '' }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="Bapin Garments home">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-display text-2xl font-bold shadow-sm transition-transform group-hover:scale-105 ${
          light ? 'bg-gold-400 text-navy-900' : 'bg-navy-800 text-gold-400'
        }`}
      >
        B
      </span>
      <span className="leading-none">
        <span className={`block font-display text-xl font-bold tracking-wide sm:text-2xl ${light ? 'text-white' : 'text-navy-800'}`}>
          BAPIN <span className={light ? 'text-gold-400' : 'text-maroon-700'}>GARMENTS</span>
        </span>
        {tagline && (
          <span className={`mt-1 block text-[10px] font-medium uppercase tracking-[0.25em] ${light ? 'text-gold-300' : 'text-gold-600'}`}>
            Your Style, Your Choice!
          </span>
        )}
      </span>
    </Link>
  );
}
