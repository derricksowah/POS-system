import { useState, useEffect, useCallback } from 'react';
import {
  getProducts, createProduct, updateProduct,
  deactivateProduct, activateProduct, deleteProduct,
} from '../../services/productService.js';
import PageHeader    from '../../components/PageHeader.jsx';
import Modal         from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Spinner       from '../../components/Spinner.jsx';
import { formatCurrency, getErrorMessage } from '../../utils/formatters.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import toast from 'react-hot-toast';

const EMPTY = { name: '', price: '', unit: 'pcs', opening_stock: '', low_stock_threshold: '5' };

export default function Products() {
  const { settings }         = useSettings();
  const [products, setProducts] = useState([]);
  const [total, setTotal]    = useState(0);
  const [page, setPage]      = useState(1);
  const [search, setSearch]  = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading]  = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]    = useState(null);
  const [form, setForm]          = useState(EMPTY);
  const [saving, setSaving]      = useState(false);
  const [confirm, setConfirm]    = useState({ open: false, product: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, product: null });
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    getProducts({ search, includeInactive: showInactive, page, limit: LIMIT })
      .then(({ products: p, total: t }) => { setProducts(p); setTotal(t); })
      .finally(() => setLoading(false));
  }, [search, showInactive, page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit   = (p) => {
    setEditing(p);
    setForm({ name: p.name, price: p.price, unit: p.unit, opening_stock: p.opening_stock, low_stock_threshold: p.low_stock_threshold });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateProduct(editing.id, { name: form.name, price: Number(form.price), unit: form.unit, low_stock_threshold: Number(form.low_stock_threshold) });
        toast.success('Product updated.');
      } else {
        await createProduct({ ...form, price: Number(form.price), opening_stock: Number(form.opening_stock), low_stock_threshold: Number(form.low_stock_threshold) });
        toast.success('Product created.');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const p = deleteConfirm.product;
    setDeleteConfirm({ open: false, product: null });
    try {
      await deleteProduct(p.id);
      toast.success(`"${p.name}" deleted.`);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const toggleActive = async () => {
    const p = confirm.product;
    setConfirm({ open: false, product: null });
    try {
      if (p.is_active) { await deactivateProduct(p.id); toast.success('Product deactivated.'); }
      else             { await activateProduct(p.id);   toast.success('Product activated.'); }
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const currency = settings.currency || 'GHS';
  const pages    = Math.ceil(total / LIMIT);

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${total} product${total !== 1 ? 's' : ''}`}
        actions={<button className="btn btn-primary" onClick={openCreate}>+ Add Product</button>}
      />
      <div className="page">

        {/* Filters */}
        <div className="card mb-2" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="form-input" placeholder="Search by name or code..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 300 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }} />
            Show deactivated
          </label>
        </div>

        {/* Table */}
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Unit</th>
                  <th>Price</th><th>Opening</th><th>Current Stock</th><th>Threshold</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
                    <td><code>{p.code}</code></td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.unit}</td>
                    <td>{formatCurrency(p.price, currency)}</td>
                    <td>{p.opening_stock}</td>
                    <td>
                      <strong style={{ color: Number(p.current_stock) <= Number(p.low_stock_threshold) ? 'var(--danger)' : 'var(--success)' }}>
                        {p.current_stock}
                      </strong>
                    </td>
                    <td>{p.low_stock_threshold}</td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-gray'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                        <button
                          className={`btn btn-sm ${p.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => setConfirm({ open: true, product: p })}
                        >
                          {p.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setDeleteConfirm({ open: true, product: p })}
                          title="Permanently delete this product"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-muted" style={{ padding: '2rem' }}>No products found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="pagination">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <span style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
              {page} / {pages}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.name}` : 'Add New Product'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="product-form" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Product Name *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              required placeholder="Full product name" />
          </div>
          {editing && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Product Code</label>
              <input className="form-input" value={editing.code} disabled style={{ backgroundColor: 'var(--bg-muted)', cursor: 'not-allowed' }} />
              <span className="form-hint">Auto-generated code cannot be changed.</span>
            </div>
          )}
          <div className="form-grid form-grid-2" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Unit *</label>
              <input className="form-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                required placeholder="pcs, bottle, kg..." />
            </div>
          </div>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Price ({currency}) *</label>
              <input type="number" min="0" step="0.01" className="form-input"
                value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Opening Stock</label>
              <input type="number" min="0" step="0.01" className="form-input"
                value={form.opening_stock}
                onChange={(e) => setForm({ ...form, opening_stock: e.target.value })}
                disabled={!!editing}
                placeholder="0"
              />
              {!!editing && <span className="form-hint">Cannot change after creation.</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Low Stock Alert</label>
              <input type="number" min="0" step="0.01" className="form-input"
                value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>

      {/* Confirm deactivate/activate */}
      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, product: null })}
        onConfirm={toggleActive}
        title={confirm.product?.is_active ? 'Deactivate Product' : 'Activate Product'}
        message={
          confirm.product?.is_active
            ? `Deactivate "${confirm.product?.name}"? It will no longer be available for sale.`
            : `Activate "${confirm.product?.name}"?`
        }
        danger={confirm.product?.is_active}
        confirmLabel={confirm.product?.is_active ? 'Deactivate' : 'Activate'}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, product: null })}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Permanently delete "${deleteConfirm.product?.name}"? This cannot be undone. Products with sales history cannot be deleted.`}
        danger
        confirmLabel="Delete"
      />
    </div>
  );
}
