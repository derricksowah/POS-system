import { useState, useEffect, useCallback } from 'react';
import { getProducts }  from '../../services/productService.js';
import { stockIn, getStockIns, updateStockIn, deleteStockIn } from '../../services/settingsService.js';
import PageHeader   from '../../components/PageHeader.jsx';
import Modal        from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Spinner      from '../../components/Spinner.jsx';
import { formatDateTime, getErrorMessage } from '../../utils/formatters.js';
import toast from 'react-hot-toast';

const EMPTY = { product_id: '', quantity: '', supplier: '', reference: '', note: '' };

export default function StockIn() {
  const [records, setRecords]  = useState([]);
  const [total, setTotal]      = useState(0);
  const [products, setProducts] = useState([]);
  const [page, setPage]        = useState(1);
  const [search, setSearch]    = useState('');
  const [dateFilters, setDateFilters] = useState({ from: '', to: '' });
  const [loading, setLoading]  = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]  = useState(null);
  const [form, setForm]        = useState(EMPTY);
  const [saving, setSaving]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, record: null });
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    getStockIns({ search, from: dateFilters.from, to: dateFilters.to, page, limit: LIMIT })
      .then(({ stockIns, total: t }) => { setRecords(stockIns); setTotal(t); })
      .finally(() => setLoading(false));
  }, [search, dateFilters.from, dateFilters.to, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getProducts({ limit: 500 }).then(({ products: p }) => setProducts(p));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    const record = deleteConfirm.record;
    setDeleteConfirm({ open: false, record: null });
    try {
      await deleteStockIn(record.id);
      toast.success('Stock-in deleted and stock reversed.');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({
      product_id: record.product_id,
      quantity: record.quantity,
      supplier: record.supplier || '',
      reference: record.reference || '',
      note: record.note || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateStockIn(editing.id, {
          quantity: Number(form.quantity),
          supplier: form.supplier,
          reference: form.reference,
          note: form.note,
        });
        toast.success('Stock-in record updated.');
      } else {
        await stockIn({ ...form, product_id: Number(form.product_id), quantity: Number(form.quantity) });
        toast.success('Stock recorded successfully.');
      }
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div>
      <PageHeader
        title="Stock In (Purchases)"
        subtitle={`${total} records`}
        actions={<button className="btn btn-primary" onClick={openCreate}>+ Record Stock In</button>}
      />
      <div className="page">
        <div className="card mb-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group">
            <label className="form-label">From</label>
            <input
              type="date"
              className="form-input"
              value={dateFilters.from}
              onChange={(e) => {
                setDateFilters({ ...dateFilters, from: e.target.value });
                setPage(1);
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-input"
              value={dateFilters.to}
              onChange={(e) => {
                setDateFilters({ ...dateFilters, to: e.target.value });
                setPage(1);
              }}
            />
          </div>
          <input
            className="form-input"
            placeholder="Search product, supplier, reference, note..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 360 }}
          />
          {(search || dateFilters.from || dateFilters.to) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearch('');
                setDateFilters({ from: '', to: '' });
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {total} record{total !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Product</th><th>Qty</th><th>Supplier</th><th>Reference</th><th>Note</th><th>Recorded By</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.created_at)}</td>
                    <td><strong>{r.product_name}</strong> <code style={{ fontSize: '0.75rem' }}>{r.product_code}</code></td>
                    <td><strong>{r.quantity} {r.unit}</strong></td>
                    <td>{r.supplier || <span className="text-muted">—</span>}</td>
                    <td>{r.reference || <span className="text-muted">—</span>}</td>
                    <td>{r.note || <span className="text-muted">—</span>}</td>
                    <td>{r.created_by_username || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => setDeleteConfirm({ open: true, record: r })}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted" style={{ padding: '2rem' }}>No stock-in records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="pagination">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <span style={{ padding: '0 0.5rem', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>{page} / {pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'Edit Stock In' : 'Record Stock In'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setModalOpen(false); setEditing(null); }}>Cancel</button>
            <button className="btn btn-primary" form="stock-form" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form id="stock-form" onSubmit={handleSave}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Product *</label>
            <select className="form-select" value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })} required disabled={!!editing}>
              <option value="">— Select product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name} (Stock: {p.current_stock})</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Quantity *</label>
            <input type="number" min="0.01" step="0.01" className="form-input"
              value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          </div>
          <div className="form-grid form-grid-2" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input className="form-input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Reference / PO#</label>
              <input className="form-input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <input className="form-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, record: null })}
        onConfirm={handleDelete}
        title="Delete Stock In"
        message={`Delete this stock-in for "${deleteConfirm.record?.product_name}"? This will reduce current stock and purchases/in by ${deleteConfirm.record?.quantity || 0}.`}
        danger
        confirmLabel="Delete"
      />
    </div>
  );
}
