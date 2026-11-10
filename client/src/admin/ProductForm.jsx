import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, History, ImagePlus, Link2, Plus, Save, Star, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, useApi } from '../lib/api';
import { imgSrc, inr } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Field, PageLoader, Spinner } from '../components/ui';
import { PageHeader, StockBadge, Toggle, useConfirm } from './ui';

const SIZE_PRESETS = {
  Adult: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  Waist: ['28', '30', '32', '34', '36', '38'],
  Kids: ['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y'],
  Baby: ['0-6M', '6-12M', '12-18M'],
  Free: ['Free Size'],
};
const COLOR_PRESETS = [
  ['White', '#FFFFFF'], ['Black', '#111111'], ['Navy', '#1B2A4A'], ['Maroon', '#7A1F2B'], ['Red', '#C62828'],
  ['Sky Blue', '#8EC5E8'], ['Grey', '#8A8D91'], ['Olive', '#6B7A3A'], ['Mustard', '#D4A017'], ['Pink', '#F06292'],
  ['Cream', '#F3EAD7'], ['Green', '#1F7A55'],
];

const EMPTY = {
  name: '', sku: '', category_id: '', description: '', fabric: '', original_price: '', discount_price: '',
  is_new_arrival: true, is_featured: false, is_best_seller: false, is_trending: false, is_active: true, low_stock_threshold: '',
};

const key = (color, size) => `${color}|||${size}`;

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { can } = useAuth();
  const canWrite = can('products.write');
  const { data: cats } = useApi('/admin/categories');
  const { data: product, loading, error, reload } = useApi(isNew ? null : `/admin/products/${id}`, { skip: isNew });
  const { data: history } = useApi(isNew ? null : `/admin/inventory/transactions?product_id=${id}&limit=8`, { skip: isNew });

  const [form, setForm] = useState(EMPTY);
  const [sizes, setSizes] = useState(['S', 'M', 'L', 'XL']);
  const [colors, setColors] = useState([]);
  const [cells, setCells] = useState({}); // key -> { id, sku, quantity, is_active }
  const [customSize, setCustomSize] = useState('');
  const [newColor, setNewColor] = useState({ name: '', hex: '#1B2A4A' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const fileRef = useRef();
  const [confirm, confirmDialog] = useConfirm();

  // Load existing product into form state
  useEffect(() => {
    if (!product) return;
    setForm({
      name: product.name, sku: product.sku, category_id: String(product.category_id), description: product.description || '',
      fabric: product.fabric || '', original_price: product.original_price, discount_price: product.discount_price ?? '',
      is_new_arrival: product.is_new_arrival, is_featured: product.is_featured, is_best_seller: product.is_best_seller,
      is_trending: product.is_trending, is_active: product.is_active, low_stock_threshold: product.low_stock_threshold ?? '',
    });
    setSizes(product.sizes);
    setColors(product.colors.map((c) => ({ name: c.name, hex: c.hex || '#cccccc' })));
    const c = {};
    for (const v of product.variants) c[key(v.color, v.size)] = { id: v.id, sku: v.sku, quantity: v.quantity, is_active: v.is_active, stock_status: v.stock_status };
    setCells(c);
    setImages(product.images);
  }, [product]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const discount = useMemo(() => {
    const o = Number(form.original_price);
    const d = Number(form.discount_price);
    return form.discount_price !== '' && o > 0 && d < o ? Math.round(((o - d) / o) * 100) : 0;
  }, [form.original_price, form.discount_price]);

  const totalQty = colors.reduce((s, c) => s + sizes.reduce((t, sz) => t + (Number(cells[key(c.name, sz)]?.quantity) || 0), 0), 0);

  const addSize = (s) => {
    const v = s.trim();
    if (v && !sizes.includes(v)) setSizes([...sizes, v]);
  };
  const removeSize = async (s) => {
    const stock = colors.reduce((t, c) => t + (Number(cells[key(c.name, s)]?.quantity) || 0), 0);
    if (stock > 0 && !(await confirm(`Size ${s} has ${stock} units in stock. Removing it will record a stock-out for those units when you save.`))) return;
    setSizes(sizes.filter((x) => x !== s));
  };
  const addColor = (name, hex) => {
    const n = name.trim();
    if (!n) return;
    if (colors.some((c) => c.name.toLowerCase() === n.toLowerCase())) return toast.error('Colour already added');
    setColors([...colors, { name: n, hex }]);
    setNewColor({ name: '', hex: '#1B2A4A' });
  };
  const removeColor = async (name) => {
    const stock = sizes.reduce((t, s) => t + (Number(cells[key(name, s)]?.quantity) || 0), 0);
    if (stock > 0 && !(await confirm(`${name} has ${stock} units in stock. Removing it will record a stock-out for those units when you save.`))) return;
    setColors(colors.filter((c) => c.name !== name));
  };
  const setQty = (color, size, value) => setCells((c) => ({ ...c, [key(color, size)]: { ...c[key(color, size)], quantity: value } }));
  const fillAll = (value) => {
    const next = { ...cells };
    for (const c of colors) for (const s of sizes) next[key(c.name, s)] = { ...next[key(c.name, s)], quantity: value };
    setCells(next);
  };

  const buildPayload = () => ({
    ...form,
    category_id: Number(form.category_id),
    original_price: Number(form.original_price),
    discount_price: form.discount_price === '' ? null : Number(form.discount_price),
    low_stock_threshold: form.low_stock_threshold === '' ? null : Number(form.low_stock_threshold),
    variants: colors.flatMap((c) =>
      sizes.map((s) => {
        const cell = cells[key(c.name, s)] || {};
        return { id: cell.id, sku: cell.sku, size: s, color: c.name, color_hex: c.hex, quantity: Number(cell.quantity) || 0, is_active: cell.is_active ?? true };
      }),
    ),
  });

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Required';
    if (!/^[A-Za-z0-9-_]{2,60}$/.test(form.sku)) e.sku = 'Letters, numbers, - and _ only';
    if (!form.category_id) e.category_id = 'Select a category';
    if (form.original_price === '' || Number(form.original_price) < 0) e.original_price = 'Enter a valid price';
    if (form.discount_price !== '' && Number(form.discount_price) > Number(form.original_price)) e.discount_price = 'Cannot exceed MRP';
    if (!colors.length) e.colors = 'Add at least one colour';
    if (!sizes.length) e.sizes = 'Add at least one size';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const uploadFiles = async (productId, files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('images', f));
      const imgs = await api(`/admin/products/${productId}/images`, { method: 'POST', body: fd, form: true });
      setImages(imgs);
      toast.success(`${files.length} image(s) uploaded`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return toast.error('Please fix the highlighted fields');
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = isNew
        ? await api('/admin/products', { method: 'POST', body: payload })
        : await api(`/admin/products/${id}`, { method: 'PUT', body: payload });
      if (isNew) {
        await uploadFiles(saved.id, pendingFiles);
        toast.success('Product created');
        navigate(`/admin/products/${saved.id}`, { replace: true });
      } else {
        toast.success('Product saved — website updated');
        reload();
      }
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onPickFiles = (fileList) => {
    const files = [...fileList].filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type));
    if (files.length !== fileList.length) toast.error('Only JPG, PNG, WEBP or GIF images are allowed');
    const tooBig = files.find((f) => f.size > 5 * 1024 * 1024);
    if (tooBig) return toast.error(`${tooBig.name} is larger than 5 MB`);
    if (isNew) setPendingFiles((p) => [...p, ...files].slice(0, 12));
    else uploadFiles(id, files);
  };

  const imageAction = async (path, method) => {
    try {
      setImages(await api(path, { method }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addImageUrl = async () => {
    if (!imageUrl.trim()) return;
    try {
      setImages(await api(`/admin/products/${id}/images/url`, { method: 'POST', body: { url: imageUrl.trim() } }));
      setImageUrl('');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!isNew && loading) return <PageLoader />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const sectionCls = 'card p-5 sm:p-6';
  const h2 = 'mb-4 font-semibold text-navy-800';

  return (
    <form onSubmit={save} className="pb-24">
      <PageHeader
        title={isNew ? 'Add New Product' : 'Edit Product'}
        subtitle={isNew ? 'Fill in the details, sizes, colours and opening stock' : `${product.name} · ${product.sku}`}
        actions={
          <>
            <Link to="/admin/products" className="btn-outline"><ArrowLeft className="h-4 w-4" /> Back</Link>
            {!isNew && <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className="btn-outline"><ExternalLink className="h-4 w-4" /> View</a>}
          </>
        }
      />

      <fieldset disabled={!canWrite} className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className={sectionCls}>
            <h2 className={h2}>Basic Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name *" error={errors.name} className="sm:col-span-2">
                <input className="input" value={form.name} onChange={set('name')} maxLength={200} />
              </Field>
              <Field label="Product code / SKU *" error={errors.sku} hint="Unique code, e.g. BG-MSH-010">
                <input className="input font-mono uppercase" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} maxLength={60} />
              </Field>
              <Field label="Category *" error={errors.category_id}>
                <select className="input" value={form.category_id} onChange={set('category_id')}>
                  <option value="">Select category</option>
                  {cats?.tree.map((parent) => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name} (general)</option>
                      {parent.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Material / Fabric" className="sm:col-span-2">
                <input className="input" value={form.fabric} onChange={set('fabric')} placeholder="e.g. 100% Cotton, Banarasi Silk" maxLength={200} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <textarea className="input min-h-28" value={form.description} onChange={set('description')} maxLength={5000} />
              </Field>
            </div>
          </section>

          <section className={sectionCls}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-navy-800">Sizes, Colours & Stock</h2>
              <span className="text-sm text-slate-500">Total: <b className="text-navy-900">{totalQty}</b> units</span>
            </div>

            <div className="mb-5">
              <span className="label">Sizes</span>
              <div className="flex flex-wrap items-center gap-2">
                {sizes.map((s) => (
                  <span key={s} className="flex items-center gap-1 rounded-md bg-navy-800 py-1 pl-3 pr-1 text-xs font-medium text-white">
                    {s}
                    <button type="button" onClick={() => removeSize(s)} className="rounded p-0.5 hover:bg-white/20" aria-label={`Remove size ${s}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <input
                  className="input w-28 py-1 text-xs"
                  placeholder="Custom size"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSize(customSize);
                      setCustomSize('');
                    }
                  }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span className="py-1 text-slate-400">Quick add:</span>
                {Object.entries(SIZE_PRESETS).map(([label, list]) => (
                  <button key={label} type="button" className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:border-navy-800" onClick={() => setSizes([...new Set([...sizes, ...list])])}>
                    + {label}
                  </button>
                ))}
              </div>
              {errors.sizes && <p className="mt-1 text-xs text-red-600">{errors.sizes}</p>}
            </div>

            <div className="mb-5">
              <span className="label">Colours</span>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((c) => (
                  <span key={c.name} className="flex items-center gap-1.5 rounded-md border border-slate-200 py-1 pl-1.5 pr-1 text-xs font-medium">
                    <input type="color" value={c.hex} onChange={(e) => setColors(colors.map((x) => (x.name === c.name ? { ...x, hex: e.target.value } : x)))} className="h-5 w-5 cursor-pointer rounded border-0 p-0" aria-label={`${c.name} colour`} />
                    {c.name}
                    <button type="button" onClick={() => removeColor(c.name)} className="rounded p-0.5 hover:bg-slate-100" aria-label={`Remove ${c.name}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <input type="color" value={newColor.hex} onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })} className="h-8 w-8 cursor-pointer rounded border border-slate-200 p-0.5" aria-label="New colour" />
                  <input
                    className="input w-32 py-1 text-xs"
                    placeholder="Colour name"
                    value={newColor.name}
                    onChange={(e) => setNewColor({ ...newColor, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addColor(newColor.name, newColor.hex);
                      }
                    }}
                  />
                  <button type="button" className="btn-outline btn-sm" onClick={() => addColor(newColor.name, newColor.hex)}><Plus className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COLOR_PRESETS.filter(([n]) => !colors.some((c) => c.name === n)).map(([n, h]) => (
                  <button key={n} type="button" title={n} onClick={() => addColor(n, h)} className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:border-navy-800">
                    <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: h }} /> {n}
                  </button>
                ))}
              </div>
              {errors.colors && <p className="mt-1 text-xs text-red-600">{errors.colors}</p>}
            </div>

            {colors.length > 0 && sizes.length > 0 && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label mb-0">Stock quantity per size & colour</span>
                  <button type="button" className="text-xs font-medium text-maroon-700 hover:underline" onClick={async () => {
                    const v = window.prompt('Set the same quantity for every variant:', '10');
                    if (v !== null && /^\d+$/.test(v)) fillAll(v);
                  }}>Fill all…</button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Colour \ Size</th>
                        {sizes.map((s) => <th key={s} className="px-2 py-2 text-center text-xs font-semibold text-slate-600">{s}</th>)}
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map((c) => (
                        <tr key={c.name} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-3 py-2">
                            <span className="flex items-center gap-2 font-medium text-navy-800">
                              <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} /> {c.name}
                            </span>
                          </td>
                          {sizes.map((s) => {
                            const cell = cells[key(c.name, s)];
                            const st = cell?.stock_status;
                            return (
                              <td key={s} className="px-1.5 py-1.5 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  className={`input w-16 px-1.5 py-1 text-center ${st === 'out_of_stock' ? 'border-red-300 bg-red-50' : st === 'low_stock' ? 'border-amber-300 bg-amber-50' : ''}`}
                                  value={cell?.quantity ?? 0}
                                  onChange={(e) => setQty(c.name, s, e.target.value)}
                                  aria-label={`${c.name} ${s} quantity`}
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right font-semibold text-navy-900">
                            {sizes.reduce((t, s) => t + (Number(cells[key(c.name, s)]?.quantity) || 0), 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {isNew
                    ? 'Quantities are recorded as opening stock (Stock In).'
                    : 'Changing a quantity here records a stock adjustment in Stock History. For deliveries and sales, use Inventory → Stock In / Stock Out.'}
                </p>
              </>
            )}
          </section>

          <section className={sectionCls}>
            <h2 className={h2}>Product Images</h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (canWrite) onPickFiles(e.dataTransfer.files);
              }}
              onClick={() => canWrite && fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-maroon-500 hover:bg-maroon-50/30"
            >
              {uploading ? <Spinner className="h-7 w-7" /> : <Upload className="h-7 w-7 text-slate-400" />}
              <p className="mt-2 text-sm font-medium text-navy-800">Click or drag images here</p>
              <p className="text-xs text-slate-500">JPG, PNG, WEBP · up to 5 MB each · max 12 images</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { onPickFiles(e.target.files); e.target.value = ''; }} />
            </div>

            {isNew && pendingFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-100">
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute left-1 top-1 rounded bg-gold-400 px-1.5 text-[10px] font-semibold text-navy-900">Main</span>}
                    <button type="button" onClick={() => setPendingFiles(pendingFiles.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600" aria-label="Remove image"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {isNew && <p className="mt-2 text-xs text-slate-500">Images will be uploaded when you save the product.</p>}

            {!isNew && (
              <>
                {images.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {images.map((im) => (
                      <div key={im.id} className={`group relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-100 ring-2 ${im.is_primary ? 'ring-gold-400' : 'ring-transparent'}`}>
                        <img src={imgSrc(im.url, 300)} alt="" className="h-full w-full object-cover" />
                        {im.is_primary && <span className="absolute left-1 top-1 rounded bg-gold-400 px-1.5 text-[10px] font-semibold text-navy-900">Main</span>}
                        {canWrite && (
                          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/60 p-1.5 opacity-0 transition group-hover:opacity-100">
                            {!im.is_primary && (
                              <button type="button" title="Set as main image" onClick={() => imageAction(`/admin/products/${id}/images/${im.id}/primary`, 'PUT')} className="rounded bg-white/90 p-1 text-gold-600"><Star className="h-3.5 w-3.5" /></button>
                            )}
                            <button
                              type="button"
                              title="Delete image"
                              onClick={async () => (await confirm('Delete this image?', { okText: 'Delete' })) && imageAction(`/admin/products/${id}/images/${im.id}`, 'DELETE')}
                              className="rounded bg-white/90 p-1 text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {canWrite && (
                  <div className="mt-4 flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input className="input pl-9" placeholder="…or paste an https:// image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                    </div>
                    <button type="button" className="btn-outline" onClick={addImageUrl}><ImagePlus className="h-4 w-4" /> Add</button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className={sectionCls}>
            <h2 className={h2}>Pricing</h2>
            <div className="space-y-4">
              <Field label="Original price / MRP (₹) *" error={errors.original_price}>
                <input type="number" min="0" step="0.01" className="input" value={form.original_price} onChange={set('original_price')} />
              </Field>
              <Field label="Discounted price (₹)" error={errors.discount_price} hint="Leave empty if not on offer">
                <input type="number" min="0" step="0.01" className="input" value={form.discount_price} onChange={set('discount_price')} />
              </Field>
              <div className="rounded-lg bg-cream p-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Selling price</span><b className="text-navy-900">{inr(form.discount_price !== '' ? form.discount_price : form.original_price || 0)}</b></div>
                <div className="mt-1 flex justify-between"><span className="text-slate-500">Discount</span><b className="text-emerald-700">{discount}%</b></div>
              </div>
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className={h2}>Labels & Visibility</h2>
            <div className="space-y-3">
              <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Visible on website" />
              <Toggle checked={form.is_new_arrival} onChange={(v) => setForm({ ...form, is_new_arrival: v })} label="New Arrival" />
              <Toggle checked={form.is_featured} onChange={(v) => setForm({ ...form, is_featured: v })} label="Featured" />
              <Toggle checked={form.is_best_seller} onChange={(v) => setForm({ ...form, is_best_seller: v })} label="Best Seller" />
              <Toggle checked={form.is_trending} onChange={(v) => setForm({ ...form, is_trending: v })} label="Trending" />
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className={h2}>Stock Alert</h2>
            <Field label="Minimum stock threshold" hint="Leave empty to use the store-wide default from Settings">
              <input type="number" min="0" className="input" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} placeholder={product ? `Default: ${product.effective_threshold}` : 'Store default'} />
            </Field>
            {product && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
                <span className="text-slate-500">Current status</span>
                <StockBadge status={product.stock_status} qty={product.total_stock} />
              </div>
            )}
          </section>

          {!isNew && history?.items?.length > 0 && (
            <section className={sectionCls}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-navy-800">Recent Stock Activity</h2>
                <Link to={`/admin/stock-history?product_id=${id}`} className="text-xs font-semibold text-maroon-700"><History className="mr-1 inline h-3.5 w-3.5" />All</Link>
              </div>
              <ul className="space-y-2 text-xs">
                {history.items.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-600">{t.variant_label} · {t.reason || t.type}</span>
                    <span className={`shrink-0 font-semibold ${t.type === 'OUT' || t.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {t.type === 'OUT' ? '−' : t.quantity >= 0 ? '+' : ''}{t.type === 'OUT' ? t.quantity : t.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </fieldset>

      {canWrite && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:pl-72">
          <div className="flex items-center justify-end gap-3">
            {Object.keys(errors).length > 0 && <span className="mr-auto text-sm text-red-600">Please fix the highlighted fields</span>}
            <Link to="/admin/products" className="btn-outline">Cancel</Link>
            <button type="submit" disabled={saving || uploading} className="btn-primary min-w-36">
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : isNew ? 'Create Product' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
      {confirmDialog}
    </form>
  );
}

