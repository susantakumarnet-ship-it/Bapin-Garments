import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-8xl font-bold text-gold-300">404</p>
      <h1 className="mt-2 font-display text-3xl text-navy-800">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you're looking for doesn't exist or has moved.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn-primary">Back to Home</Link>
        <Link to="/shop" className="btn-outline">Browse Products</Link>
      </div>
    </div>
  );
}
