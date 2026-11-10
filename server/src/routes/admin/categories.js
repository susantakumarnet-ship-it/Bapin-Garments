import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../../db/index.js';
import { ah, validate, HttpError, slugify } from '../../utils/helpers.js';
import { can } from '../../middleware/auth.js';
import { buildTree } from '../public.js';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().max(120).optional().default(''),
  parent_id: z.coerce.number().int().positive().nullable().optional(),
  description: z.string().trim().max(1000).optional().default(''),
  image_url: z.string().trim().max(1000).optional().default(''),
  sort_order: z.coerce.number().int().min(0).max(9999).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

router.get(
  '/',
  ah(async (_req, res) => {
    const rows = await query(
      `SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count,
              (SELECT COALESCE(SUM(i.quantity),0)::int FROM products p
                 JOIN product_variants v ON v.product_id = p.id JOIN inventory i ON i.variant_id = v.id
                WHERE p.category_id = c.id) AS stock
       FROM product_categories c ORDER BY c.sort_order, c.name`,
    );
    res.json({ items: rows, tree: buildTree(rows) });
  }),
);

async function assertNoCycle(id, parentId) {
  if (!parentId) return;
  if (parentId === id) throw new HttpError(400, 'A category cannot be its own parent');
  const rows = await query(
    `WITH RECURSIVE anc AS (
       SELECT id, parent_id FROM product_categories WHERE id = $1
       UNION ALL SELECT c.id, c.parent_id FROM product_categories c JOIN anc ON c.id = anc.parent_id
     ) SELECT id FROM anc WHERE id = $2`,
    [parentId, id],
  );
  if (rows.length) throw new HttpError(400, 'Cannot move a category under its own sub-category');
}

router.post(
  '/',
  can('categories.write'),
  ah(async (req, res) => {
    const d = validate(schema, req.body);
    const row = await one(
      `INSERT INTO product_categories (name, slug, parent_id, description, image_url, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.name, slugify(d.slug || d.name), d.parent_id || null, d.description, d.image_url || null, d.sort_order, d.is_active],
    );
    res.status(201).json(row);
  }),
);

router.put(
  '/:id',
  can('categories.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const d = validate(schema, req.body);
    await assertNoCycle(id, d.parent_id || null);
    const row = await one(
      `UPDATE product_categories SET name=$2, slug=$3, parent_id=$4, description=$5, image_url=$6, sort_order=$7, is_active=$8, updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, d.name, slugify(d.slug || d.name), d.parent_id || null, d.description, d.image_url || null, d.sort_order, d.is_active],
    );
    if (!row) throw new HttpError(404, 'Category not found');
    res.json(row);
  }),
);

router.delete(
  '/:id',
  can('categories.write'),
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const usage = await one(
      `SELECT (SELECT COUNT(*)::int FROM products WHERE category_id = $1) AS products,
              (SELECT COUNT(*)::int FROM product_categories WHERE parent_id = $1) AS children`,
      [id],
    );
    if (usage.products) throw new HttpError(409, `Move or delete the ${usage.products} product(s) in this category first`);
    if (usage.children) throw new HttpError(409, `Delete or move the ${usage.children} sub-categories first`);
    const row = await one('DELETE FROM product_categories WHERE id = $1 RETURNING id', [id]);
    if (!row) throw new HttpError(404, 'Category not found');
    res.json({ ok: true });
  }),
);

export default router;
