import { Router } from 'express';
import { z } from 'zod';
import { query, one, transaction } from '../db/index.js';
import { ah, validate, HttpError, digitsOnly } from '../utils/helpers.js';
import { listProducts, getProduct, sortSizes } from '../services/products.js';
import { getPublicSettings } from '../services/settings.js';
import { notifyOwnerOfEnquiry } from '../services/whatsapp.js';
import { enquiryLimiter } from '../middleware/security.js';

const router = Router();

router.get(
  '/settings',
  ah(async (_req, res) => res.json(await getPublicSettings())),
);

/** Category tree with product counts (including sub-categories). */
router.get(
  '/categories',
  ah(async (_req, res) => {
    const rows = await query(
      `SELECT c.id, c.name, c.slug, c.parent_id, c.description, c.image_url, c.sort_order,
              (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.is_active) AS product_count
       FROM product_categories c WHERE c.is_active ORDER BY c.sort_order, c.name`,
    );
    res.json(buildTree(rows));
  }),
);

export function buildTree(rows) {
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id).children.push(node);
    else roots.push(node);
  }
  const total = (n) => (n.total_count = n.product_count + n.children.reduce((s, c) => s + total(c), 0));
  roots.forEach(total);
  return roots;
}

router.get(
  '/products',
  ah(async (req, res) => {
    const data = await listProducts(req.query, { publicOnly: true, maxLimit: 48 });
    // Admin-only fields are not needed on the storefront.
    data.items = data.items.map(({ threshold, view_count, enquiry_count, ...rest }) => rest);
    res.json(data);
  }),
);

router.get(
  '/products/:slug',
  ah(async (req, res) => {
    const product = await getProduct({ slug: req.params.slug }, { publicOnly: true });
    if (!product) throw new HttpError(404, 'Product not found');
    await query('UPDATE products SET view_count = view_count + 1 WHERE id = $1', [product.id]);
    const related = await listProducts(
      { category_id: product.category_id, exclude_id: product.id, limit: 8, sort: 'popular' },
      { publicOnly: true },
    );
    const { low_stock_threshold, effective_threshold, view_count, enquiry_count, category_active, ...pub } = product;
    pub.variants = pub.variants.map(({ stock_updated_at, is_active, ...v }) => v);
    res.json({ product: pub, related: related.items });
  }),
);

/** Filter facets for the shop page. */
router.get(
  '/filters',
  ah(async (_req, res) => {
    const sizes = await query(
      `SELECT DISTINCT v.size FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.is_active AND p.is_active`,
    );
    const colors = await query(
      `SELECT v.color AS name, MAX(v.color_hex) AS hex, COUNT(DISTINCT v.product_id)::int AS count
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.is_active AND p.is_active GROUP BY v.color ORDER BY count DESC, v.color`,
    );
    const price = await one(
      `SELECT COALESCE(MIN(COALESCE(discount_price, original_price)),0) AS min,
              COALESCE(MAX(COALESCE(discount_price, original_price)),0) AS max FROM products WHERE is_active`,
    );
    res.json({ sizes: sortSizes(sizes.map((s) => s.size)), colors, price });
  }),
);

/** Everything the home page needs in one request. */
router.get(
  '/home',
  ah(async (_req, res) => {
    const opts = { publicOnly: true };
    const [featured, latest, trending, bestSellers, offers] = await Promise.all([
      listProducts({ tag: 'featured', limit: 8 }, opts),
      listProducts({ sort: 'newest', limit: 8 }, opts),
      listProducts({ tag: 'trending', sort: 'popular', limit: 8 }, opts),
      listProducts({ tag: 'bestseller', limit: 8 }, opts),
      listProducts({ tag: 'offers', sort: 'discount', limit: 8 }, opts),
    ]);
    const strip = (d) => d.items.map(({ threshold, view_count, enquiry_count, ...r }) => r);
    res.json({
      featured: strip(featured),
      latest: strip(latest),
      trending: strip(trending),
      bestSellers: strip(bestSellers),
      offers: strip(offers),
    });
  }),
);

const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  mobile: z
    .string()
    .trim()
    .transform(digitsOnly)
    .refine((v) => /^(91)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email').max(160)]).optional(),
  subject: z.string().trim().min(2, 'Please enter a subject').max(200),
  product_name: z.string().trim().max(200).optional().default(''),
  product_id: z.coerce.number().int().positive().optional().nullable(),
  message: z.string().trim().min(5, 'Please write a short message').max(2000),
  consent: z.boolean().optional().default(false),
  source: z.enum(['contact_form', 'product_page']).optional().default('contact_form'),
  // Honeypot field — real users never fill this in.
  website: z.string().max(0, 'Spam detected').optional(),
});

router.post(
  '/enquiries',
  enquiryLimiter,
  ah(async (req, res) => {
    const data = validate(enquirySchema, req.body);
    const mobile = data.mobile.length === 12 ? data.mobile.slice(2) : data.mobile;

    let productName = data.product_name || null;
    let productId = null;
    if (data.product_id) {
      const p = await one('SELECT id, name, sku FROM products WHERE id = $1', [data.product_id]);
      if (p) {
        productId = p.id;
        productName = productName || `${p.name} (${p.sku})`;
      }
    }

    const enquiry = await transaction(async (tx) => {
      const { rows: cust } = await tx.query(
        `INSERT INTO customers (name, mobile, email, whatsapp_consent)
         VALUES ($1, $2, NULLIF($3, ''), $4)
         ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name,
           email = COALESCE(EXCLUDED.email, customers.email),
           whatsapp_consent = customers.whatsapp_consent OR EXCLUDED.whatsapp_consent,
           updated_at = NOW()
         RETURNING id`,
        [data.name, mobile, data.email || '', data.consent],
      );
      const { rows } = await tx.query(
        `INSERT INTO customer_enquiries (customer_id, name, mobile, email, subject, product_id, product_name, message, source, ip_address)
         VALUES ($1,$2,$3,NULLIF($4,''),$5,$6,$7,$8,$9,$10) RETURNING *`,
        [cust[0].id, data.name, mobile, data.email || '', data.subject, productId, productName, data.message, data.source, req.ip],
      );
      if (productId) await tx.query('UPDATE products SET enquiry_count = enquiry_count + 1 WHERE id = $1', [productId]);
      return rows[0];
    });

    // Fire-and-forget: the customer should not wait for the WhatsApp API.
    notifyOwnerOfEnquiry(enquiry);

    res.status(201).json({
      ok: true,
      id: enquiry.id,
      message: 'Thank you! Your enquiry has been received. Our team will contact you shortly.',
    });
  }),
);

export default router;
