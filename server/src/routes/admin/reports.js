import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { query } from '../../db/index.js';
import { ah, HttpError, toInt } from '../../utils/helpers.js';
import { getLowStockThreshold, getAllSettings } from '../../services/settings.js';
import { productStockCte, stockStatusSql, STATUS_LABEL } from '../../services/inventory.js';
import { discountPercent, sizeRank } from '../../services/products.js';
import { enquiryWhere } from './enquiries.js';

const router = Router();

const NAVY = '1B2A4A';
const MAROON = '7A1F2B';

// ---------------------------------------------------------------- report builders

function categoryFilter(q, params, alias = 'p') {
  const id = toInt(q.category_id);
  if (!id) return 'TRUE';
  params.push(id);
  return `${alias}.category_id IN (WITH RECURSIVE tree AS (SELECT id FROM product_categories WHERE id = $${params.length}
            UNION ALL SELECT c2.id FROM product_categories c2 JOIN tree t ON c2.parent_id = t.id) SELECT id FROM tree)`;
}

async function variantStockRows(q, statusFilter) {
  const threshold = await getLowStockThreshold();
  const params = [threshold];
  const thr = 'COALESCE(p.low_stock_threshold, $1)';
  const cat = categoryFilter(q, params);
  const rows = await query(
    `SELECT p.sku AS product_sku, p.name AS product_name, c.name AS category, v.sku AS variant_sku, v.size, v.color,
            COALESCE(i.quantity,0)::int AS quantity, ${thr}::int AS threshold,
            COALESCE(p.discount_price, p.original_price)::float AS price,
            ${stockStatusSql('COALESCE(i.quantity,0)', thr)} AS status, i.updated_at
     FROM product_variants v JOIN products p ON p.id = v.product_id
     JOIN product_categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.variant_id = v.id
     WHERE v.is_active AND ${cat} ${statusFilter ? `AND ${stockStatusSql('COALESCE(i.quantity,0)', thr)} = '${statusFilter}'` : ''}
     ORDER BY c.name, p.name, v.color`,
    params,
  );
  rows.sort((a, b) => a.category.localeCompare(b.category) || a.product_name.localeCompare(b.product_name) || a.color.localeCompare(b.color) || sizeRank(a.size) - sizeRank(b.size));
  return rows.map((r) => ({ ...r, status: STATUS_LABEL[r.status], value: r.quantity * r.price }));
}

const variantColumns = [
  { key: 'product_sku', header: 'Product SKU', width: 14 },
  { key: 'product_name', header: 'Product', width: 30 },
  { key: 'category', header: 'Category', width: 16 },
  { key: 'size', header: 'Size', width: 8 },
  { key: 'color', header: 'Colour', width: 12 },
  { key: 'quantity', header: 'Qty', width: 8, type: 'int' },
  { key: 'threshold', header: 'Min Level', width: 9, type: 'int' },
  { key: 'price', header: 'Price', width: 11, type: 'money' },
  { key: 'value', header: 'Stock Value', width: 13, type: 'money' },
  { key: 'status', header: 'Status', width: 12 },
];

const REPORTS = {
  products: {
    title: 'Complete Product List',
    async build(q) {
      const threshold = await getLowStockThreshold();
      const params = [threshold];
      const cat = categoryFilter(q, params);
      const rows = await query(
        `${productStockCte('$1')}
         SELECT p.*, c.name AS category, s.total_stock, ${stockStatusSql('s.total_stock', 's.threshold')} AS status,
                (SELECT COUNT(*)::int FROM product_variants v WHERE v.product_id = p.id) AS variants
         FROM products p JOIN product_categories c ON c.id = p.category_id JOIN stock s ON s.product_id = p.id
         WHERE ${cat} ORDER BY c.name, p.name`,
        params,
      );
      return rows.map((r) => ({
        sku: r.sku,
        name: r.name,
        category: r.category,
        fabric: r.fabric,
        original_price: r.original_price,
        discount_price: r.discount_price ?? r.original_price,
        discount: discountPercent(r.original_price, r.discount_price),
        variants: r.variants,
        stock: r.total_stock,
        status: STATUS_LABEL[r.status],
        labels: [r.is_new_arrival && 'New', r.is_featured && 'Featured', r.is_best_seller && 'Best Seller', r.is_trending && 'Trending']
          .filter(Boolean)
          .join(', '),
        active: r.is_active ? 'Yes' : 'No',
        created_at: r.created_at,
      }));
    },
    columns: [
      { key: 'sku', header: 'SKU', width: 13 },
      { key: 'name', header: 'Product', width: 30 },
      { key: 'category', header: 'Category', width: 15 },
      { key: 'fabric', header: 'Fabric', width: 16 },
      { key: 'original_price', header: 'MRP', width: 10, type: 'money' },
      { key: 'discount_price', header: 'Selling', width: 10, type: 'money' },
      { key: 'discount', header: 'Disc %', width: 7, type: 'int' },
      { key: 'variants', header: 'Variants', width: 8, type: 'int' },
      { key: 'stock', header: 'Stock', width: 8, type: 'int' },
      { key: 'status', header: 'Status', width: 12 },
      { key: 'labels', header: 'Labels', width: 18 },
      { key: 'active', header: 'Active', width: 7 },
      { key: 'created_at', header: 'Added On', width: 11, type: 'date' },
    ],
  },

  'category-inventory': {
    title: 'Category-wise Inventory',
    async build() {
      const threshold = await getLowStockThreshold();
      const rows = await query(
        `${productStockCte('$1')}
         SELECT c.name AS category, pc.name AS parent,
                COUNT(DISTINCT p.id)::int AS products,
                (SELECT COUNT(*)::int FROM product_variants v JOIN products p2 ON p2.id = v.product_id WHERE p2.category_id = c.id) AS variants,
                COALESCE(SUM(s.total_stock),0)::int AS units,
                COUNT(p.id) FILTER (WHERE s.total_stock > 0 AND s.total_stock <= s.threshold)::int AS low,
                COUNT(p.id) FILTER (WHERE s.total_stock <= 0)::int AS out,
                COALESCE(SUM(s.total_stock * COALESCE(p.discount_price, p.original_price)),0)::float AS value
         FROM product_categories c
         LEFT JOIN product_categories pc ON pc.id = c.parent_id
         LEFT JOIN products p ON p.category_id = c.id
         LEFT JOIN stock s ON s.product_id = p.id
         GROUP BY c.id, c.name, pc.name
         HAVING COUNT(p.id) > 0
         ORDER BY pc.name NULLS FIRST, c.name`,
        [threshold],
      );
      return rows.map((r) => ({ ...r, parent: r.parent || '—' }));
    },
    columns: [
      { key: 'parent', header: 'Department', width: 16 },
      { key: 'category', header: 'Category', width: 22 },
      { key: 'products', header: 'Products', width: 10, type: 'int' },
      { key: 'variants', header: 'Variants', width: 10, type: 'int' },
      { key: 'units', header: 'Units in Stock', width: 14, type: 'int' },
      { key: 'low', header: 'Low Stock', width: 10, type: 'int' },
      { key: 'out', header: 'Out of Stock', width: 12, type: 'int' },
      { key: 'value', header: 'Stock Value', width: 15, type: 'money' },
    ],
    totals: ['products', 'variants', 'units', 'low', 'out', 'value'],
  },

  'available-stock': {
    title: 'Available Stock Report',
    build: async (q) => (await variantStockRows(q)).filter((r) => r.quantity > 0),
    columns: variantColumns,
    totals: ['quantity', 'value'],
  },

  'low-stock': {
    title: 'Low Stock Report',
    build: (q) => variantStockRows(q, 'low_stock'),
    columns: variantColumns,
    totals: ['quantity', 'value'],
  },

  'out-of-stock': {
    title: 'Out of Stock Report',
    build: (q) => variantStockRows(q, 'out_of_stock'),
    columns: variantColumns.filter((c) => !['value', 'quantity'].includes(c.key)),
  },

  enquiries: {
    title: 'Customer Enquiry Report',
    async build(q) {
      const w = enquiryWhere(q);
      const rows = await query(`SELECT e.* FROM customer_enquiries e ${w.sql} ORDER BY e.created_at DESC`, w.params);
      return rows;
    },
    columns: [
      { key: 'id', header: 'ID', width: 6, type: 'int' },
      { key: 'created_at', header: 'Date', width: 16, type: 'datetime' },
      { key: 'name', header: 'Customer', width: 18 },
      { key: 'mobile', header: 'Mobile', width: 13 },
      { key: 'email', header: 'Email', width: 22 },
      { key: 'subject', header: 'Subject', width: 20 },
      { key: 'product_name', header: 'Product', width: 22 },
      { key: 'message', header: 'Message', width: 40 },
      { key: 'status', header: 'Status', width: 10 },
      { key: 'internal_remarks', header: 'Remarks', width: 25 },
    ],
  },

  'monthly-inventory': {
    title: 'Monthly Inventory Report',
    subtitle: (q) => `Month: ${monthOf(q)}`,
    async build(q) {
      const month = monthOf(q);
      const params = [`${month}-01`];
      const cat = categoryFilter(q, params);
      // Net movement per type: IN adds, OUT removes, ADJUST stores a signed delta.
      const rows = await query(
        `WITH bounds AS (SELECT $1::date AS start, ($1::date + INTERVAL '1 month') AS finish),
         cur AS (
           SELECT p.id, COALESCE(SUM(i.quantity),0)::int AS current
           FROM products p LEFT JOIN product_variants v ON v.product_id = p.id LEFT JOIN inventory i ON i.variant_id = v.id
           GROUP BY p.id
         ),
         mv AS (
           SELECT t.product_id,
             COALESCE(SUM(CASE WHEN t.type='IN' THEN t.quantity END) FILTER (WHERE t.created_at >= b.start AND t.created_at < b.finish),0)::int AS stock_in,
             COALESCE(SUM(CASE WHEN t.type='OUT' THEN t.quantity END) FILTER (WHERE t.created_at >= b.start AND t.created_at < b.finish),0)::int AS stock_out,
             COALESCE(SUM(CASE WHEN t.type='ADJUST' THEN t.quantity END) FILTER (WHERE t.created_at >= b.start AND t.created_at < b.finish),0)::int AS adjust,
             COALESCE(SUM(CASE WHEN t.type='OUT' THEN -t.quantity ELSE t.quantity END) FILTER (WHERE t.created_at >= b.finish),0)::int AS after_net
           FROM stock_transactions t CROSS JOIN bounds b GROUP BY t.product_id
         )
         SELECT p.sku, p.name, c.name AS category,
                COALESCE(mv.stock_in,0) AS stock_in, COALESCE(mv.stock_out,0) AS stock_out, COALESCE(mv.adjust,0) AS adjust,
                (cur.current - COALESCE(mv.after_net,0)) AS closing
         FROM products p
         JOIN product_categories c ON c.id = p.category_id
         JOIN cur ON cur.id = p.id
         LEFT JOIN mv ON mv.product_id = p.id
         CROSS JOIN bounds b
         WHERE p.created_at < b.finish AND ${cat}
         ORDER BY c.name, p.name`,
        params,
      );
      return rows.map((r) => ({ ...r, opening: r.closing - r.stock_in + r.stock_out - r.adjust }));
    },
    columns: [
      { key: 'sku', header: 'SKU', width: 13 },
      { key: 'name', header: 'Product', width: 32 },
      { key: 'category', header: 'Category', width: 16 },
      { key: 'opening', header: 'Opening', width: 10, type: 'int' },
      { key: 'stock_in', header: 'Stock In', width: 10, type: 'int' },
      { key: 'stock_out', header: 'Stock Out', width: 10, type: 'int' },
      { key: 'adjust', header: 'Adjust (±)', width: 10, type: 'int' },
      { key: 'closing', header: 'Closing', width: 10, type: 'int' },
    ],
    totals: ['opening', 'stock_in', 'stock_out', 'adjust', 'closing'],
  },
};

function monthOf(q) {
  if (typeof q.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month)) return q.month;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- formatting

const fmtDate = (v, withTime) => {
  if (!v) return '';
  const d = new Date(v);
  const opts = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('en-IN', opts);
};

function cellText(col, v) {
  if (v === null || v === undefined) return '';
  switch (col.type) {
    case 'money':
      return `Rs. ${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    case 'int':
      return String(v);
    case 'date':
      return fmtDate(v);
    case 'datetime':
      return fmtDate(v, true);
    default:
      return String(v);
  }
}

function computeTotals(def, rows) {
  if (!def.totals || !rows.length) return null;
  const t = {};
  for (const k of def.totals) t[k] = rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return t;
}

async function toXlsx(def, rows, meta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bapin Garments';
  wb.created = new Date();
  const ws = wb.addWorksheet(def.title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }] });
  const n = def.columns.length;

  ws.mergeCells(1, 1, 1, n);
  ws.getCell(1, 1).value = `${meta.storeName.toUpperCase()} — ${def.title}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF' + NAVY } };
  ws.mergeCells(2, 1, 2, n);
  ws.getCell(2, 1).value = `${meta.subtitle ? meta.subtitle + '  |  ' : ''}Generated: ${fmtDate(new Date(), true)}  |  Records: ${rows.length}`;
  ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF666666' } };

  const header = ws.getRow(4);
  def.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } };
    cell.alignment = { vertical: 'middle' };
    ws.getColumn(i + 1).width = c.width || 14;
  });
  header.height = 20;

  rows.forEach((r, ri) => {
    const row = ws.getRow(5 + ri);
    def.columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      let v = r[c.key];
      if (c.type === 'date' || c.type === 'datetime') v = v ? new Date(v) : null;
      cell.value = v ?? '';
      if (c.type === 'money') cell.numFmt = '"₹"#,##0.00';
      if (c.type === 'date') cell.numFmt = 'dd-mmm-yyyy';
      if (c.type === 'datetime') cell.numFmt = 'dd-mmm-yyyy hh:mm';
      if (ri % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F4EF' } };
    });
  });

  const totals = computeTotals(def, rows);
  if (totals) {
    const row = ws.getRow(5 + rows.length);
    row.getCell(1).value = 'TOTAL';
    def.columns.forEach((c, i) => {
      if (c.key in totals) {
        row.getCell(i + 1).value = totals[c.key];
        if (c.type === 'money') row.getCell(i + 1).numFmt = '"₹"#,##0.00';
      }
    });
    row.font = { bold: true, color: { argb: 'FF' + MAROON } };
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } };
  return wb.xlsx.writeBuffer();
}

function toPdf(def, rows, meta, res) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
  doc.pipe(res);
  const pageW = doc.page.width - 60;
  const totalW = def.columns.reduce((s, c) => s + (c.width || 14), 0);
  const widths = def.columns.map((c) => ((c.width || 14) / totalW) * pageW);
  const rowH = 18;

  const drawTitle = () => {
    doc.rect(30, 26, pageW, 44).fill('#' + NAVY);
    doc.fillColor('#D4AF37').font('Helvetica-Bold').fontSize(16).text(meta.storeName.toUpperCase(), 42, 34);
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(10).text(def.title, 42, 53);
    doc
      .fontSize(8)
      .text(`${meta.subtitle ? meta.subtitle + '  |  ' : ''}Generated ${fmtDate(new Date(), true)}  |  ${rows.length} records`, 30, 53, {
        width: pageW - 12,
        align: 'right',
      });
    doc.y = 80;
  };
  const drawHeader = () => {
    let x = 30;
    const y = doc.y;
    doc.rect(30, y, pageW, rowH).fill('#' + MAROON);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    def.columns.forEach((c, i) => {
      doc.text(c.header, x + 3, y + 5, {
        width: widths[i] - 6,
        height: rowH,
        ellipsis: true,
        lineBreak: false,
        align: c.type === 'money' || c.type === 'int' ? 'right' : 'left',
      });
      x += widths[i];
    });
    doc.y = y + rowH;
  };

  drawTitle();
  drawHeader();
  doc.font('Helvetica').fontSize(7.5);

  const drawRow = (r, i, bold) => {
    if (doc.y + rowH > doc.page.height - 40) {
      doc.addPage();
      doc.y = 30;
      drawHeader();
      doc.font('Helvetica').fontSize(7.5);
    }
    const y = doc.y;
    if (i % 2 || bold) doc.rect(30, y, pageW, rowH).fill(bold ? '#EFE6D0' : '#F6F4EF');
    doc.fillColor('#222222').font(bold ? 'Helvetica-Bold' : 'Helvetica');
    let x = 30;
    def.columns.forEach((c, ci) => {
      const txt = r.__label && ci === 0 ? r.__label : cellText(c, r[c.key]);
      doc.text(txt, x + 3, y + 5, {
        width: widths[ci] - 6,
        height: rowH,
        ellipsis: true,
        lineBreak: false,
        align: c.type === 'money' || c.type === 'int' ? 'right' : 'left',
      });
      x += widths[ci];
    });
    doc.y = y + rowH;
  };

  if (!rows.length) {
    doc.fillColor('#666666').fontSize(11).text('No records found for the selected filters.', 30, doc.y + 20);
  }
  rows.forEach((r, i) => drawRow(r, i, false));
  const totals = computeTotals(def, rows);
  if (totals) drawRow({ ...totals, __label: 'TOTAL' }, 0, true);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing inside the bottom margin must not trigger a new page
    doc
      .fillColor('#999999')
      .fontSize(7)
      .text(`${meta.storeName} • ${def.title} • Page ${i + 1} of ${range.count}`, 30, doc.page.height - 25, {
        width: pageW,
        align: 'center',
        lineBreak: false,
      });
  }
  doc.end();
}

// ---------------------------------------------------------------- routes

router.get('/', (_req, res) => {
  res.json(Object.entries(REPORTS).map(([key, d]) => ({ key, title: d.title })));
});

router.get(
  '/:type',
  ah(async (req, res) => {
    const def = REPORTS[req.params.type];
    if (!def) throw new HttpError(404, 'Unknown report');
    const rows = await def.build(req.query);
    const settings = await getAllSettings();
    const meta = { storeName: settings.store_name || 'Bapin Garments', subtitle: def.subtitle?.(req.query) };
    const format = String(req.query.format || 'json');
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `bapin-${req.params.type}-${stamp}`;

    if (format === 'xlsx') {
      const buf = await toXlsx(def, rows, meta);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(Buffer.from(buf));
    }
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return toPdf(def, rows, meta, res);
    }
    res.json({
      title: def.title,
      subtitle: meta.subtitle,
      columns: def.columns,
      rows: rows.slice(0, 500),
      total_rows: rows.length,
      totals: computeTotals(def, rows),
    });
  }),
);

export default router;
