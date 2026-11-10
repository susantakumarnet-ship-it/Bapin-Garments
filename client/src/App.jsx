import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { AuthProvider } from './context/AuthContext';
import StoreLayout from './components/store/StoreLayout';
import { PageLoader } from './components/ui';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

// Admin portal is code-split so customers never download it.
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const Login = lazy(() => import('./admin/Login'));
const ForgotPassword = lazy(() => import('./admin/ForgotPassword'));
const ResetPassword = lazy(() => import('./admin/ResetPassword'));
const Dashboard = lazy(() => import('./admin/Dashboard'));
const Products = lazy(() => import('./admin/Products'));
const ProductForm = lazy(() => import('./admin/ProductForm'));
const Inventory = lazy(() => import('./admin/Inventory'));
const StockHistory = lazy(() => import('./admin/StockHistory'));
const Categories = lazy(() => import('./admin/Categories'));
const Enquiries = lazy(() => import('./admin/Enquiries'));
const Reports = lazy(() => import('./admin/Reports'));
const Settings = lazy(() => import('./admin/Settings'));
const Users = lazy(() => import('./admin/Users'));
const WhatsAppLogs = lazy(() => import('./admin/WhatsAppLogs'));
const Account = lazy(() => import('./admin/Account'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route index element={<Home />} />
              <Route path="shop" element={<Shop />} />
              <Route path="shop/:categorySlug" element={<Shop />} />
              <Route path="men" element={<Navigate to="/shop/men" replace />} />
              <Route path="women" element={<Navigate to="/shop/women" replace />} />
              <Route path="kids" element={<Navigate to="/shop/kids" replace />} />
              <Route path="new-arrivals" element={<Shop preset="new" />} />
              <Route path="offers" element={<Shop preset="offers" />} />
              <Route path="search" element={<Shop />} />
              <Route path="product/:slug" element={<ProductDetail />} />
              <Route path="about" element={<About />} />
              <Route path="contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="admin/login" element={<Login />} />
            <Route path="admin/forgot-password" element={<ForgotPassword />} />
            <Route path="admin/reset-password" element={<ResetPassword />} />
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductForm />} />
              <Route path="products/:id" element={<ProductForm />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="stock-history" element={<StockHistory />} />
              <Route path="categories" element={<Categories />} />
              <Route path="enquiries" element={<Enquiries />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="users" element={<Users />} />
              <Route path="whatsapp-logs" element={<WhatsAppLogs />} />
              <Route path="account" element={<Account />} />
            </Route>
          </Routes>
        </Suspense>
      </StoreProvider>
    </AuthProvider>
  );
}
