import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, IndianRupee, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, qs, useApi } from '../lib/api';
import { imgSrc, inr, fmtDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Empty, ErrorBox, Field, Modal, Pagination, Spinner } from '../components/ui';
import { FilterBar, PageHeader, StockBadge, useConfirm } from './ui';

export default function Products() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const f = {
    q: params.get('q') || '',
    category_id: params.get('category_id') || '',
    stock_status: params.get('stock_status') || '',
    tag: params.get('tag') || '',
    active: params.get('active') || '',
    sort: params.get('sort') || 'newest',
    page: params.get('page') || '1',
  };
  const [search, setSearch] = useState(f.q);
  const { data, loading, error, reload } = useApi(`/admin/products${qs({ ...f, limit: 20 })}`);
  const { data: cats } = useApi('/admin/categories');
  const [confirm, confirmDialog] = useConfirm();
  const [priceEdit, setPriceEdit] = useState(null);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const remove = async (p) => {
    if (!(await confirm(`Delete "${p.name}"? This also removes its images, variants, stock and history. This cannot be undone.`, { okText: 'Delete product' }))) return;
    try {
      await api(`/admin/products/${p.id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const savePrice = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/products/${priceEdit.id}/price`, {
        method: 'PATCH',
        body: { original_price: priceEdit.original_price, discount_price: priceEdit.discount_price === '' ? null : priceEdit.discount_price },
      });
      toast.success('Price updated');
      setPriceEdit(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={data ? `${data.total} products` : 'Manage your garment catalogue'}
        actions={can('products.write') && <Link to="/admin/products/new" className="btn-primary"><Plus className="h-4 w-4" /> Add Product</Link>}
      />

      <FilterBar>
        <form className="relative min-w-52 flex-[2]" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
          <span className="label">Search</span>
          <input className="input pl-9" placeholder="Name, SKU, fabric..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search className="absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" />
        </form>
        <label className="min-w-40 flex-1">
          <span className="label">Category</span>
          <select className="input" value={f.category_id} onChange={(e) => update({ category_id: e.target.value })}>
            <option value="">All</option>
            {cats?.items.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
          </select>
        </label>
        <label className="min-w-32">
          <span className="label">Stock</span>
          <select className="input" value={f.stock_status} onChange={(e) => update({ stock_status: e.target.value })}>
            <option value="">All</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </label>
        <label className="min-w-32">
          <span className="label">Label</span>
          <select className="input" value={f.tag} onChange={(e) => update({ tag: e.target.value })}>
            <option value="">All</option>
            <option value="new">New Arrival</option>
            <option value="featured">Featured</option>
            <option value="bestseller">Best Seller</option>
            <option value="trending">Trending</option>
            <option value="offers">On Discount</option>
          </select>
        </label>
        <label className="min-w-28">
          <span className="label">Visibility</span>
          <select className="input" value={f.active} onChange={(e) => update({ active: e.target.value })}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Hidden</option>
          </select>
        </label>
        <label className="min-w-36">
          <span className="label">Sort</span>
          <select className="input" value={f.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
            <option value="stock_asc">Stock: low → high</option>
            <option value="stock_desc">Stock: high → low</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
            <option value="popular">Most viewed</option>
            <option value="enquiries">Most enquired</option>
          </select>
        </label>
      </FilterBar>

      <ErrorBox error={error} onRetry={reload} />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
        ) : !data?.items.length ? (
          <Empty title="No products found" text="Try changing the filters or add a new product." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-right">Price</th>
                  <th>Stock</th>
                  <th>Labels</th>
                  <th className="text-right">Views / Enq.</th>
                  <th>Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className={!p.is_active ? 'opacity-60' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <img src={imgSrc(p.image, 120)} alt="" className="h-14 w-11 shrink-0 rounded object-cover" />
                        <div className="min-w-0">
                          <Link to={`/admin/products/${p.id}`} className="line-clamp-1 font-medium text-navy-800 hover:text-maroon-700">{p.name}</Link>
                          <p className="font-mono text-xs text-slate-400">{p.sku}</p>
                          {!p.is_active && <span className="badge-slate mt-0.5">Hidden</span>}
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-600">
                      {p.category_name}
                      <p className="text-xs text-slate-400">{p.parent_category_name}</p>
                    </td>
                    <td className="text-right">
                      <p className="font-semibold text-navy-900">{inr(p.price)}</p>
                      {p.discount_percent > 0 && <p className="text-xs text-slate-400"><span className="line-through">{inr(p.original_price)}</span> <span className="text-emerald-600">-{p.discount_percent}%</span></p>}
                    </td>
                    <td><StockBadge status={p.stock_status} qty={p.total_stock} /></td>
                    <td>
                      <div className="flex max-w-40 flex-wrap gap-1">
                        {p.is_new_arrival && <span className="badge-blue">New</span>}
                        {p.is_featured && <span className="badge-maroon">Featured</span>}
                        {p.is_best_seller && <span className="badge-gold">Best Seller</span>}
                        {p.is_trending && <span className="badge-slate">Trending</span>}
                      </div>
                    </td>
                    <td className="text-right text-slate-600">{p.view_count} / {p.enquiry_count}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(p.created_at)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {can('products.write') && (
                          <button className="btn-ghost btn-sm" title="Update price" onClick={() => setPriceEdit({ id: p.id, name: p.name, original_price: p.original_price, discount_price: p.discount_price ?? '' })}>
                            <IndianRupee className="h-4 w-4" />
                          </button>
                        )}
                        <Link to={`/admin/products/${p.id}`} className="btn-ghost btn-sm" title="Edit"><Pencil className="h-4 w-4" /></Link>
                        <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="View on website"><ExternalLink className="h-4 w-4" /></a>
                        {can('products.delete') && (
                          <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" title="Delete" onClick={() => remove(p)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => update({ page: String(page) })} />}

      <Modal
        open={Boolean(priceEdit)}
        onClose={() => setPriceEdit(null)}
        title="Update Price"
        size="max-w-sm"
        footer={<><button className="btn-outline" onClick={() => setPriceEdit(null)}>Cancel</button><button form="price-form" className="btn-primary">Save</button></>}
      >
        {priceEdit && (
          <form id="price-form" onSubmit={savePrice} className="space-y-4">
            <p className="text-sm font-medium text-navy-800">{priceEdit.name}</p>
            <Field label="Original price (MRP) ₹">
              <input type="number" min="0" step="0.01" className="input" value={priceEdit.original_price} onChange={(e) => setPriceEdit({ ...priceEdit, original_price: e.target.value })} required />
            </Field>
            <Field label="Discounted price ₹" hint="Leave empty for no discount">
              <input type="number" min="0" step="0.01" className="input" value={priceEdit.discount_price} onChange={(e) => setPriceEdit({ ...priceEdit, discount_price: e.target.value })} />
            </Field>
            {priceEdit.discount_price !== '' && Number(priceEdit.original_price) > 0 && (
              <p className="text-sm text-emerald-700">Discount: {Math.round(((priceEdit.original_price - priceEdit.discount_price) / priceEdit.original_price) * 100)}%</p>
            )}
          </form>
        )}
      </Modal>
      {confirmDialog}
    </>
  );
}
