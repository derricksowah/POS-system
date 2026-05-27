import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import { getCurrentStock, reconcileStock } from '../services/stockService.js';
import { getErrorMessage } from '../utils/formatters.js';
import toast from 'react-hot-toast';

export default function StockReconciliation({ open, onClose }) {
  const [loading, setLoading]       = useState(false);
  const [products, setProducts]     = useState([]);
  const [counts, setCounts]         = useState({});
  const [adjusting, setAdjusting]   = useState({});
  const [adjustingAll, setAdjustingAll] = useState(false);
  const [search, setSearch]         = useState('');

  const load = useCallback(() => {
    if (!open) return;
    setLoading(true);
    getCurrentStock()
      .then((data) => {
        setProducts(data);
        const initial = {};
        data.forEach((p) => { initial[p.id] = ''; });
        setCounts(initial);
        setSearch('');
      })
      .catch(() => toast.error('Failed to load stock.'))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => { load(); }, [load]);

  const getDiff = (product) => {
    const val = counts[product.id];
    if (val === '' || val === undefined || val === null) return null;
    const num = parseFloat(val);
    if (isNaN(num)) return null;
    return +(num - Number(product.current_stock)).toFixed(4);
  };

  const discrepant = products.filter((p) => {
    const d = getDiff(p);
    return d !== null && d !== 0;
  });

  const handleAdjustOne = async (product) => {
    const diff = getDiff(product);
    if (diff === null || diff === 0) return;
    const counted = parseFloat(counts[product.id]);
    setAdjusting((prev) => ({ ...prev, [product.id]: true }));
    try {
      await reconcileStock([{ product_id: product.id, counted_quantity: counted }]);
      toast.success(`"${product.name}" adjusted (${diff > 0 ? '+' : ''}${diff.toFixed(2)}).`);
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, current_stock: counted } : p)
      );
      setCounts((prev) => ({ ...prev, [product.id]: '' }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdjusting((prev) => ({ ...prev, [product.id]: false }));
    }
  };

  const handleAdjustAll = async () => {
    if (discrepant.length === 0) return;
    setAdjustingAll(true);
    try {
      const payload = discrepant.map((p) => ({
        product_id:       p.id,
        counted_quantity: parseFloat(counts[p.id]),
      }));
      const res = await reconcileStock(payload);
      toast.success(`${res.results?.length ?? discrepant.length} product(s) adjusted successfully.`);
      setProducts((prev) =>
        prev.map((p) => {
          const adj = payload.find((a) => a.product_id === p.id);
          return adj ? { ...p, current_stock: adj.counted_quantity } : p;
        })
      );
      setCounts((prev) => {
        const next = { ...prev };
        discrepant.forEach((p) => { next[p.id] = ''; });
        return next;
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdjustingAll(false);
    }
  };

  const filtered = products.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  const anyEntered = products.some((p) => counts[p.id] !== '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Stock Reconciliation"
      maxWidth={940}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem' }}>
          <span style={{ fontSize: '0.84rem', color: discrepant.length > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {!anyEntered
              ? 'Enter counted quantities to begin reconciliation'
              : discrepant.length > 0
                ? `${discrepant.length} discrepanc${discrepant.length === 1 ? 'y' : 'ies'} found`
                : 'All entered quantities match recorded stock'}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <button
              className="btn btn-primary"
              onClick={handleAdjustAll}
              disabled={discrepant.length === 0 || adjustingAll}
            >
              {adjustingAll ? 'Adjusting…' : `Adjust All Discrepancies${discrepant.length > 0 ? ` (${discrepant.length})` : ''}`}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ padding: '1rem 1.5rem 0' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Enter the physically counted quantity for each product. The system will compare it against
          the recorded stock and highlight discrepancies. Use <strong>Adjust</strong> per row or
          <strong> Adjust All Discrepancies</strong> to apply all changes at once.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          {anyEntered && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const reset = {};
                products.forEach((p) => { reset[p.id] = ''; });
                setCounts(reset);
              }}
            >
              ✕ Clear all
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? <Spinner /> : (
          <div className="table-wrap" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Code</th>
                  <th>Product Name</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Recorded Stock</th>
                  <th style={{ textAlign: 'right', width: 120 }}>Counted Qty</th>
                  <th style={{ textAlign: 'right', width: 110 }}>Difference</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const diff     = getDiff(p);
                  const hasDiff  = diff !== null && diff !== 0;
                  const isMatch  = diff !== null && diff === 0;
                  const rowBg    = hasDiff
                    ? diff > 0
                      ? 'rgba(21,128,61,0.06)'
                      : 'rgba(185,28,28,0.06)'
                    : undefined;
                  const diffColor = hasDiff
                    ? diff > 0 ? 'var(--success)' : 'var(--danger)'
                    : 'var(--text-muted)';

                  return (
                    <tr key={p.id} style={{ background: rowBg }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td><code>{p.code}</code></td>
                      <td>
                        <strong>{p.name}</strong>
                        {!p.is_active && (
                          <span className="badge badge-gray" style={{ fontSize: '0.68rem', marginLeft: 6 }}>
                            inactive
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {Number(p.current_stock).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          style={{ width: 100, textAlign: 'right', padding: '0.28rem 0.45rem', fontSize: '0.9rem' }}
                          placeholder="—"
                          value={counts[p.id] ?? ''}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: diffColor, fontSize: '0.92rem' }}>
                        {diff === null
                          ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
                          : isMatch
                            ? <span style={{ color: 'var(--success)' }}>✓ Match</span>
                            : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`}
                      </td>
                      <td>
                        {hasDiff && (
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ whiteSpace: 'nowrap' }}
                            onClick={() => handleAdjustOne(p)}
                            disabled={adjusting[p.id] || adjustingAll}
                          >
                            {adjusting[p.id] ? '…' : 'Adjust'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted" style={{ padding: '2rem' }}>
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
