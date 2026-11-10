import { Router } from 'express';
import { z } from 'zod';
import { col, insert, NO_ID } from '../../db/index.js';
import { loadCatalog } from '../../services/catalog.js';
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
    const { categories, products } = await loadCatalog();
    const rows = categories
      .map((c) => {
        const own = products.filter((p) => p.category_id === c.id);
        return {
          ...c,
          product_count: own.length,
          stock: own.reduce((s, p) => s + p.variants.reduce((t, v) => t + v.quantity, 0), 0),
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    res.json({ items: rows, tree: buildTree(rows) });
  }),
);

async function assertNoCycle(id, parentId) {
  if (!parentId) return;
  if (parentId === id) throw new HttpError(400, 'A category cannot be its own parent');
  const all = await col('product_categories').find({}, { projection: { _id: 0, id: 1, parent_id: 1 } }).toArray();
  const byId = new Map(all.map((c) => [c.id, c]));
  for (let cur = byId.get(parentId), i = 0; cur && i < 100; cur = byId.get(cur.parent_id), i++) {
    if (cur.id === id) throw new HttpError(400, 'Cannot move a category under its own sub-category');
  }
}

router.post(
  '/',
  can('categories.write'),
  ah(async (req, res) => {
    const d = validate(schema, req.body);
    if (d.parent_id && !(await col('product_categories').findOne({ id: d.parent_id }))) throw new HttpError(400, 'Parent category not found');
    const now = new Date();
    const row = await insert('product_categories', {
      name: d.name,
      slug: slugify(d.slug || d.name),
      parent_id: d.parent_id || null,
      description: d.description,
      image_url: d.image_url || null,
      sort_order: d.sort_order,
      is_active: d.is_active,
      created_at: now,
      updated_at: now,
    });
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
    if (d.parent_id && !(await col('product_categories').findOne({ id: d.parent_id }))) throw new HttpError(400, 'Parent category not found');
    const row = await col('product_categories').findOneAndUpdate(
      { id },
      {
        $set: {
          name: d.name,
          slug: slugify(d.slug || d.name),
          parent_id: d.parent_id || null,
          description: d.description,
          image_url: d.image_url || null,
          sort_order: d.sort_order,
          is_active: d.is_active,
          updated_at: new Date(),
        },
      },
      { returnDocument: 'after', ...NO_ID },
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
    const usage = {
      products: await col('products').countDocuments({ category_id: id }),
      children: await col('product_categories').countDocuments({ parent_id: id }),
    };
    if (usage.products) throw new HttpError(409, `Move or delete the ${usage.products} product(s) in this category first`);
    if (usage.children) throw new HttpError(409, `Delete or move the ${usage.children} sub-categories first`);
    const { deletedCount } = await col('product_categories').deleteOne({ id });
    if (!deletedCount) throw new HttpError(404, 'Category not found');
    res.json({ ok: true });
  }),
);

export default router;
