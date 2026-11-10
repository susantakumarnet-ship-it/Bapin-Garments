import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config.js';
import { apiLimiter, csrfGuard, errorHandler } from './middleware/security.js';
import { requireAuth, can } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import categoryRoutes from './routes/admin/categories.js';
import productRoutes from './routes/admin/products.js';
import inventoryRoutes from './routes/admin/inventory.js';
import enquiryRoutes from './routes/admin/enquiries.js';
import dashboardRoutes from './routes/admin/dashboard.js';
import reportRoutes from './routes/admin/reports.js';
import settingsRoutes from './routes/admin/settings.js';
import userRoutes from './routes/admin/users.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'frame-src': ["'self'", 'https://www.google.com', 'https://maps.google.com'],
          'connect-src': ["'self'"],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  if (!config.isProd) app.use(morgan('dev'));

  // Uploaded images (local storage mode)
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      maxAge: '30d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use('/api', apiLimiter, csrfGuard);
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);

  const admin = express.Router();
  admin.use(requireAuth);
  admin.use('/dashboard', can('dashboard.view'), dashboardRoutes);
  admin.use('/categories', can('products.view'), categoryRoutes);
  admin.use('/products', can('products.view'), productRoutes);
  admin.use('/inventory', can('products.view'), inventoryRoutes);
  admin.use('/enquiries', can('enquiries.view'), enquiryRoutes);
  admin.use('/reports', can('reports.view'), reportRoutes);
  admin.use('/settings', settingsRoutes);
  admin.use('/users', can('users.manage'), userRoutes);
  app.use('/api/admin', admin);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built React app in production (single deployable).
  if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
