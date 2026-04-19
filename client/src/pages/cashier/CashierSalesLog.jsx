import { useState, useEffect, useCallback } from 'react';
import { getSales, getSale } from '../../services/salesService.js';
import PageHeader    from '../../components/PageHeader.jsx';
import Modal         from '../../components/Modal.jsx';
import Spinner       from '../../components/Spinner.jsx';
import { formatCurrency, formatDateTime, todayISO, getErrorMessage } from '../../utils/formatters.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import toast from 'react-hot-toast';

export default function CashierSalesLog() {
  const { settings }       = useSettings();
  const currency           = settings.currency || 'GHS';
  const [sales, setSales]  = useState([]);
  const [total, setTotal]  = useState(0);
  const [page, setPage]    = useState(1);
  const [filters, setFilters] = useState({ from: todayISO(), to: todayISO(), status: '' });
  const [loading, setLoading]     = useState(true);
  const [detailSale, setDetailSale] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    getSales({ ...filters, excludeVoided: true, page, limit: LIMIT })
      .then(({ sales: s, total: t }) => { setSales(s); setTotal(t); })
      .catch((err) => {
        console.error('Error loading sales:', err);
        toast.error(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    try {
      const sale = await getSale(id);
      setDetailSale(sale);
      setDetailOpen(true);
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
          <button className="btn btn-primary" onClick={() => { setPage(1); load(); }}>Filter</button>
        </div>

        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Receipt #</th><th>Date & Time</th><th>Cashier</th><th>Items</th><th>Total</th><th>Status</th><th>Action</th></tr>
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
                      <button className="btn btn-outline btn-sm" onClick={() => openDetail(s.id)}>View</button>
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

      {/* Detail Modal — View Only */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Sale: ${detailSale?.receipt_number}`} maxWidth={700}
        footer={
          <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>Close</button>
        }
      >
        {detailSale && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.88rem' }}>
              <div><span className="text-muted">Cashier:</span> <strong>{detailSale.cashier_name}</strong></div>
              <div><span className="text-muted">Date:</span> <strong>{formatDateTime(detailSale.created_at)}</strong></div>
              <div><span className="text-muted">Status:</span> <span className={`badge ${detailSale.status === 'completed' ? 'badge-success' : detailSale.status === 'edited' ? 'badge-warning' : 'badge-danger'}`}>{detailSale.status}</span></div>
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
                    <td>{formatCurrency(item.unit_price, currency)}</td>
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
    </div>
  );
}
