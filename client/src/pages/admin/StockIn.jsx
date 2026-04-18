import { useState, useEffect, useCallback } from 'react';
import { getProducts }  from '../../services/productService.js';
import { stockIn, getStockIns } from '../../services/settingsService.js';
import PageHeader   from '../../components/PageHeader.jsx';
import Modal        from '../../components/Modal.jsx';
import Spinner      from '../../components/Spinner.jsx';
import { formatDateTime, getErrorMessage } from '../../utils/formatters.js';
import toast from 'react-hot-toast';

const EMPTY = { product_id: '', quantity: '', supplier: '', reference: '', note: '' };

export default function StockIn() {
  const [records, setRecords]  = useState([]);
  const [total, setTotal]      = useState(0);
  const [products, setProducts] = useState([]);
  const [page, setPage]        = useState(1);
  const [loading, setLoading]  = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]        = useState(EMPTY);
  const [saving, setSaving]    = useState(false);
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    getStockIns({ page, limit: LIMIT })
      .then(({ stockIns, total: t }) => { setRecords(stockIns); setTotal(t); })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getProducts({ limit: 500 }).then(({ products: p }) => setProducts(p));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await stockIn({ ...form, product_id: Number(form.product_id), quantity: Number(form.quantity) });
      toast.success('Stock recorded successfully.');
      setModalOpen(false);
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
        actions={<button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Record Stock In</button>}
      />
      <div className="page">
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Product</th><th>Qty</th><th>Supplier</th><th>Reference</th><th>Note</th><th>Recorded By</th></tr>
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
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted" style={{ padding: '2rem' }}>No stock-in records yet.</td></tr>
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
        open={modalOpen} onClose={() => setModalOpen(false)} title="Record Stock In"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
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
              onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
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
    </div>
  );
}
