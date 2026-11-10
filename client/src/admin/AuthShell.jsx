import { Link } from 'react-router-dom';

const BG = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80';

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-navy-900 lg:block">
        <img src={BG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="font-display text-4xl font-bold">
            BAPIN <span className="text-gold-400">GARMENTS</span>
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-gold-300">Your Style, Your Choice!</p>
          <p className="mt-6 max-w-md text-sm text-slate-300">
            Manage your garments, size-wise stock, customer enquiries and WhatsApp communication — all in one place.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-cream p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 block text-center font-display text-2xl font-bold text-navy-800 lg:hidden">
            BAPIN <span className="text-maroon-700">GARMENTS</span>
          </Link>
          <div className="card p-8">
            <h1 className="font-display text-2xl font-semibold text-navy-800">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            <Link to="/" className="hover:text-maroon-700">← Back to website</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
