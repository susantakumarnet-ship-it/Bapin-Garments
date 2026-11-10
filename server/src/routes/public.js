import { Router } from 'express';
import { z } from 'zod';
import { col, insert } from '../db/index.js';
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
    const [cats, counts] = await Promise.all([
      col('product_categories')
        .find(
          { is_active: true },
          { projection: { _id: 0, id: 1, name: 1, slug: 1, parent_id: 1, description: 1, image_url: 1, sort_order: 1 } },
        )
        .toArray(),
      col('products')
        .aggregate([{ $match: { is_active: true } }, { $group: { _id: '$category_id', n: { $sum: 1 } } }])
        .toArray(),
    ]);
    const countBy = new Map(counts.map((c) => [c._id, c.n]));
    const rows = cats
      .map((c) => ({ ...c, product_count: countBy.get(c.id) || 0 }))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
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
    await col('products').updateOne({ id: product.id }, { $inc: { view_count: 1 } });
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
    const products = await col('products')
      .find({ is_active: true }, { projection: { _id: 0, id: 1, original_price: 1, discount_price: 1 } })
      .toArray();
    const activeIds = new Set(products.map((p) => p.id));
    const variants = (
      await col('product_variants')
        .find({ is_active: true }, { projection: { _id: 0, product_id: 1, size: 1, color: 1, color_hex: 1 } })
        .toArray()
    ).filter((v) => activeIds.has(v.product_id));
    const colorMap = new Map();
    for (const v of variants) {
      const c = colorMap.get(v.color) || { name: v.color, hex: null, products: new Set() };
      if (v.color_hex && (!c.hex || v.color_hex > c.hex)) c.hex = v.color_hex;
      c.products.add(v.product_id);
      colorMap.set(v.color, c);
    }
    const colors = [...colorMap.values()]
      .map((c) => ({ name: c.name, hex: c.hex, count: c.products.size }))
      .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const prices = products.map((p) => p.discount_price ?? p.original_price);
    const price = { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
    res.json({ sizes: sortSizes([...new Set(variants.map((v) => v.size))]), colors, price });
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
      const p = await col('products').findOne({ id: data.product_id }, { projection: { _id: 0, id: 1, name: 1, sku: 1 } });
      if (p) {
        productId = p.id;
        productName = productName || `${p.name} (${p.sku})`;
      }
    }

    const now = new Date();
    const existing = await col('customers').findOne({ mobile });
    let customerId;
    if (existing) {
      customerId = existing.id;
      await col('customers').updateOne(
        { id: existing.id },
        {
          $set: {
            name: data.name,
            email: data.email || existing.email || null,
            whatsapp_consent: Boolean(existing.whatsapp_consent || data.consent),
            updated_at: now,
          },
        },
      );
    } else {
      try {
        customerId = (
          await insert('customers', {
            name: data.name,
            mobile,
            email: data.email || null,
            whatsapp_consent: data.consent,
            created_at: now,
            updated_at: now,
          })
        ).id;
      } catch (err) {
        if (err?.code !== 11000) throw err; // same mobile submitted twice at once
        customerId = (await col('customers').findOne({ mobile })).id;
      }
    }
    const enquiry = await insert('customer_enquiries', {
      customer_id: customerId,
      name: data.name,
      mobile,
      email: data.email || null,
      subject: data.subject,
      product_id: productId,
      product_name: productName,
      message: data.message,
      status: 'New',
      internal_remarks: null,
      source: data.source,
      ip_address: req.ip,
      created_at: now,
      updated_at: now,
    });
    if (productId) await col('products').updateOne({ id: productId }, { $inc: { enquiry_count: 1 } });

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
