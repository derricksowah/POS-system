import { useState, useEffect, useCallback } from 'react';
import { getSales, getSale, editSale, voidSale, permanentDeleteSale } from '../../services/salesService.js';
import { getProducts } from '../../services/productService.js';
import PageHeader    from '../../components/PageHeader.jsx';
import Modal         from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Spinner       from '../../components/Spinner.jsx';
import { formatCurrency, formatDateTime, todayISO, getErrorMessage } from '../../utils/formatters.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import toast from 'react-hot-toast';

export default function SalesLog() {
  const { settings }       = useSettings();
  const currency           = settings.currency || 'GHS';
  const [sales, setSales]  = useState([]);
  const [total, setTotal]  = useState(0);
  const [page, setPage]    = useState(1);
  const [filters, setFilters] = useState({ from: todayISO(), to: todayISO(), status: '', search: '' });
  const [loading, setLoading]     = useState(true);
  const [detailSale, setDetailSale] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen]   = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editNotes, setEditNotes] = useState('');
  const [products, setProducts]   = useState([]);
  const [saving, setSaving]       = useState(false);
  const [voidConfirm, setVoidConfirm] = useState({ open: false, sale: null });
  const [permanentConfirm, setPermanentConfirm] = useState({ open: false, sale: null });
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    getSales({ ...filters, page, limit: LIMIT })
      .then(({ sales: s, total: t }) => { setSales(s); setTotal(t); })
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getProducts({ limit: 500 }).then(({ products: p }) => setProducts(p));
  }, []);

  const openDetail = async (id) => {
    const sale = await getSale(id);
    setDetailSale(sale);
    setDetailOpen(true);
  };

  const openEdit = (sale) => {
    setDetailSale(sale);
    setEditItems(sale.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, name: i.product_name })));
    setEditNotes(sale.notes || '');
    setDetailOpen(false);
    setEditOpen(true);
  };

  const addItem = () => setEditItems([...editItems, { product_id: '', quantity: 1, unit_price: 0, name: '' }]);
  const removeItem = (i) => setEditItems(editItems.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    const next = [...editItems];
    next[i] = { ...next[i], [field]: val };
    if (field === 'product_id') {
      const p = products.find((p) => String(p.id) === String(val));
      if (p) { next[i].unit_price = p.price; next[i].name = p.name; }
    }
    setEditItems(next);
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await editSale(detailSale.id, {
        items: editItems.map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
        notes: editNotes,
      });
      toast.success('Sale updated.');
      setEditOpen(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    const sale = voidConfirm.sale;
    setVoidConfirm({ open: false, sale: null });
    try {
      await voidSale(sale.id);
      toast.success('Sale voided and stock restored.');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePermanentDelete = async () => {
    const sale = permanentConfirm.sale;
    setPermanentConfirm({ open: false, sale: null });
    try {
      await permanentDeleteSale(sale.id);
      toast.success('Sale permanently erased.');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div>
      <PageHeader title="Sales Log" subtitle={`${total} transactions`} />
      <div className="page">

        {/* Filters */}
        <div className="card mb-2" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ minWidth: 130 }}>
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="edited">Edited</option>
              <option value="voided">Voided</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 240 }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              placeholder="Receipt, cashier, product..."
              value={filters.search}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => { setPage(1); load(); }}>Filter</button>
        </div>

        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Receipt #</th><th>Date & Time</th><th>Cashier</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td><code>{s.receipt_number}</code></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(s.created_at)}</td>
                    <td>{s.cashier_name}</td>
                    <td>{s.item_count}</td>
                    <td><strong>{formatCurrency(s.grand_total, currency)}</strong></td>
                    <td>
                      <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'edited' ? 'badge-warning' : 'badge-danger'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openDetail(s.id)}>View</button>
                        {s.status !== 'voided' && (
                          <>
                            <button className="btn btn-danger btn-sm" onClick={() => setVoidConfirm({ open: true, sale: s })}>Void</button>
                            <button className="btn btn-sm" style={{ color: '#fff', background: '#dc2626' }} onClick={() => setPermanentConfirm({ open: true, sale: s })}>Erase</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted" style={{ padding: '2rem' }}>No sales found for this period.</td></tr>
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

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Sale: ${detailSale?.receipt_number}`} maxWidth={700}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>Close</button>
            {detailSale?.status !== 'voided' && (
              <button className="btn btn-accent" onClick={() => openEdit(detailSale)}>Edit Sale</button>
            )}
          </>
        }
      >
        {detailSale && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.88rem' }}>
              <div><span className="text-muted">Cashier:</span> <strong>{detailSale.cashier_name}</strong></div>
              <div><span className="text-muted">Date:</span> <strong>{formatDateTime(detailSale.created_at)}</strong></div>
              <div><span className="text-muted">Status:</span> <span className={`badge ${detailSale.status === 'completed' ? 'badge-success' : detailSale.status === 'edited' ? 'badge-warning' : 'badge-danger'}`}>{detailSale.status}</span></div>
              <div><span className="text-muted">Payment:</span> <strong>{detailSale.payment_method === 'split' ? 'Cash + MoMo' : detailSale.payment_method === 'momo' ? 'MoMo' : 'Cash'}</strong></div>
              {Number(detailSale.cash_amount || 0) > 0 && <div><span className="text-muted">Cash:</span> <strong>{formatCurrency(detailSale.cash_amount, currency)}</strong></div>}
              {Number(detailSale.momo_amount || 0) > 0 && <div><span className="text-muted">MoMo:</span> <strong>{formatCurrency(detailSale.momo_amount, currency)}</strong></div>}
              {detailSale.edited_by && <div><span className="text-muted">Edited by:</span> <strong>{detailSale.edited_by}</strong></div>}
            </div>
            <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--primary)', color: '#fff' }}>
                <tr><th style={{ padding: '0.5rem' }}>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {detailSale.items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>{item.product_name}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>
                      {formatCurrency(item.unit_price, currency)}
                      {Number(item.discount_amount || 0) > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 700 }}>
                          Discount {formatCurrency(item.discount_amount, currency)}
                        </div>
                      )}
                    </td>
                    <td><strong>{formatCurrency(item.subtotal, currency)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>Grand Total:</td>
                  <td style={{ padding: '0.5rem', fontWeight: 700 }}>{formatCurrency(detailSale.grand_total, currency)}</td></tr>
              </tfoot>
            </table>
            {detailSale.notes && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Notes: {detailSale.notes}</p>}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit Sale: ${detailSale?.receipt_number}`} maxWidth={700}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn btn-accent" onClick={handleEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </>
        }
      >
        <div>
          {editItems.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'end' }}>
              <div className="form-group">
                {i === 0 && <label className="form-label">Product</label>}
                <select className="form-select" value={item.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)}>
                  <option value="">— Select —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                {i === 0 && <label className="form-label">Qty</label>}
                <input type="number" min="0.01" step="0.01" className="form-input" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
              </div>
              <div className="form-group">
                {i === 0 && <label className="form-label">Unit Price</label>}
                <input type="number" min="0" step="0.01" className="form-input" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
              </div>
              <button className="btn btn-danger btn-sm" style={{ marginBottom: '0' }} onClick={() => removeItem(i)}>✕</button>
            </div>
          ))}
          <button className="btn btn-outline btn-sm mt-1" onClick={addItem}>+ Add Item</button>

          <div className="form-group mt-2">
            <label className="form-label">Admin Notes</label>
            <input className="form-input" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Reason for edit..." />
          </div>
        </div>
      </Modal>

      {/* Void confirm */}
      <ConfirmDialog
        open={voidConfirm.open}
        onClose={() => setVoidConfirm({ open: false, sale: null })}
        onConfirm={handleVoid}
        title="Void Sale"
        message={`Void sale ${voidConfirm.sale?.receipt_number}? This will restore stock and cannot be undone.`}
        danger
        confirmLabel="Void Sale"
      />

      {/* Permanent delete confirm */}
      <ConfirmDialog
        open={permanentConfirm.open}
        onClose={() => setPermanentConfirm({ open: false, sale: null })}
        onConfirm={handlePermanentDelete}
        title="Permanently Erase Sale"
        message={`Permanently erase sale ${permanentConfirm.sale?.receipt_number}? This will completely remove all related data and cannot be undone.`}
        danger
        confirmLabel="Erase Forever"
      />
    </div>
  );
}
