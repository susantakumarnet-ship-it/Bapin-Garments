import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Boxes, ExternalLink, FileSpreadsheet, FolderTree, History, KeyRound, LayoutDashboard, LogOut, Menu,
  MessageSquare, Package, Settings, Shield, Users, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui';
import { WhatsAppIcon } from '../components/store/WhatsAppButton';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view', end: true },
  { to: '/admin/products', label: 'Products', icon: Package, perm: 'products.view' },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes, perm: 'products.view' },
  { to: '/admin/stock-history', label: 'Stock History', icon: History, perm: 'products.view' },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree, perm: 'products.view' },
  { to: '/admin/enquiries', label: 'Enquiries', icon: MessageSquare, perm: 'enquiries.view' },
  { to: '/admin/reports', label: 'Reports', icon: FileSpreadsheet, perm: 'reports.view' },
  { to: '/admin/whatsapp-logs', label: 'WhatsApp Logs', icon: WhatsAppIcon, perm: 'settings.view' },
  { to: '/admin/settings', label: 'Settings', icon: Settings, perm: 'settings.view' },
  { to: '/admin/users', label: 'Admin Users', icon: Users, perm: 'users.manage' },
];

const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', staff: 'Staff' };

export default function AdminLayout() {
  const { user, checking, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.title = 'Admin | Bapin Garments';
  }, []);

  if (checking) return <PageLoader />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  const items = NAV.filter((n) => can(n.perm));

  const Sidebar = (
    <div className="flex h-full flex-col bg-navy-900 text-slate-300">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-400 font-display text-xl font-bold text-navy-900">B</span>
        <div className="leading-tight">
          <p className="font-display text-base font-bold tracking-wide text-white">BAPIN GARMENTS</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold-400">Admin Portal</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive ? 'bg-gold-400 text-navy-900 shadow' : 'hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link to="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/5 hover:text-white">
          <ExternalLink className="h-4 w-4" /> View Website
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{Sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-up">
            {Sidebar}
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-white" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-navy-800">{user.name}</p>
              <p className="flex items-center justify-end gap-1 text-xs text-slate-500">
                <Shield className="h-3 w-3" /> {ROLE_LABEL[user.role]}
              </p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-maroon-700 text-sm font-semibold text-white">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <Link to="/admin/account" className="btn-ghost btn-sm" title="Change password">
              <KeyRound className="h-4 w-4" />
            </Link>
            <button onClick={logout} className="btn-ghost btn-sm" title="Log out">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

