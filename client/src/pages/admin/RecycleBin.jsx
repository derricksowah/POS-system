import { useState, useEffect } from 'react';
import { getDeletedProducts, restoreProduct, permanentDeleteProduct } from '../../services/productService.js';
import PageHeader    from '../../components/PageHeader.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Spinner       from '../../components/Spinner.jsx';
import { formatCurrency, getErrorMessage } from '../../utils/formatters.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import toast from 'react-hot-toast';

export default function RecycleBin() {
  const { settings }        = useSettings();
  const currency            = settings.currency || 'GHS';
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);

  const [restoreConfirm, setRestoreConfirm]   = useState({ open: false, product: null });
  const [permanentConfirm, setPermanentConfirm] = useState({ open: false, product: null });

  const load = () => {
    setLoading(true);
    getDeletedProducts().then(setProducts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async () => {
    const p = restoreConfirm.product;
    setRestoreConfirm({ open: false, product: null });
    try {
      await restoreProduct(p.id);
      toast.success(`"${p.name}" restored successfully.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePermanentDelete = async () => {
    const p = permanentConfirm.product;
    setPermanentConfirm({ open: false, product: null });
    try {
      await permanentDeleteProduct(p.id);
      toast.success(`"${p.name}" permanently deleted.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Recycle Bin"
        subtitle="Deleted products — restore to bring them back or permanently delete"
        actions={
          <button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>
        }
      />
      <div className="page">

        {/* Info banner */}
        <div className="alert alert-info mb-3" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ</span>
          <div>
            <strong>About the Recycle Bin</strong>
            <p style={{ marginTop: 3, fontSize: '0.85rem' }}>
              Products here were soft-deleted — their stock history, purchase records, and sales data are fully preserved.
              <br />Restore a product to make it available again. Permanent deletion is blocked if the product has any sales history.
            </p>
          </div>
        </div>

        {loading ? <Spinner /> : products.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🗑️</div>
            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem' }}>Recycle bin is empty</div>
            <div style={{ fontSize: '0.85rem' }}>Deleted products will appear here.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Product Name</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Stock at Deletion</th>
                  <th style={{ textAlign: 'right' }}>Threshold</th>
                  <th>Deleted On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ opacity: 0.85 }}>
                    <td><code>{p.code}</code></td>
                    <td>
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                        Opening: {Number(p.opening_stock).toFixed(2)}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{p.unit}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(p.price, currency)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: Number(p.current_stock) > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                        {Number(p.current_stock).toFixed(2)}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {Number(p.low_stock_threshold).toFixed(2)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {new Date(p.deleted_at).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => setRestoreConfirm({ open: true, product: p })}
                        >
                          ↩ Restore
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setPermanentConfirm({ open: true, product: p })}
                        >
                          Delete Forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore confirm */}
      <ConfirmDialog
        open={restoreConfirm.open}
        onClose={() => setRestoreConfirm({ open: false, product: null })}
        onConfirm={handleRestore}
        title="Restore Product"
        message={`Restore "${restoreConfirm.product?.name}"? It will become active and available for sale again.`}
        confirmLabel="Restore"
        danger={false}
      />

      {/* Permanent delete confirm */}
      <ConfirmDialog
        open={permanentConfirm.open}
        onClose={() => setPermanentConfirm({ open: false, product: null })}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete"
        message={`Permanently delete "${permanentConfirm.product?.name}"? This cannot be undone. All historical data including stock movements and sales records will be removed from the audit trail.`}
        confirmLabel="Delete Forever"
        danger
      />
    </div>
  );
}
