import { useState, useEffect } from 'react';
import { getSalesReport, downloadSalesReportPDF, downloadSalesReportExcel } from '../../services/reportService.js';
import PageHeader  from '../../components/PageHeader.jsx';
import Spinner     from '../../components/Spinner.jsx';
import toast       from 'react-hot-toast';
import { formatCurrency, formatDateTime, todayISO } from '../../utils/formatters.js';
import { useSettings } from '../../context/SettingsContext.jsx';

export default function SalesReport() {
  const { settings }      = useSettings();
  const currency          = settings.currency || 'GHS';
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: todayISO(), to: todayISO(), search: '' });
  const [grouped, setGrouped] = useState(false);

  const load = () => {
    setLoading(true);
    getSalesReport(filters)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Grouped rows ──────────────────────────────────────────────
  const groupedRows = (() => {
    if (!data?.rows?.length) return [];
    const map = new Map();
    for (const r of data.rows) {
      const key = r.product_code;
      if (!map.has(key)) {
        map.set(key, {
          product_code: r.product_code,
          product_name: r.product_name,
          unit:         r.unit,
          unit_price:   Number(r.unit_price),
          total_qty:    0,
          total_amount: 0,
          transactions: 0,
        });
      }
      const g = map.get(key);
      g.total_qty    += Number(r.quantity);
      g.total_amount += Number(r.amount);
      g.transactions += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount);
  })();

  const grandTotal = data?.rows.reduce((s, r) => s + Number(r.amount), 0) ?? 0;
  const totalQty   = data?.rows.reduce((s, r) => s + Number(r.quantity), 0) ?? 0;

  const displayRows   = grouped ? groupedRows : (data?.rows ?? []);
  const hasData       = data && data.rows.length > 0;

  return (
    <div>
      <PageHeader
        title="Sales Report"
        actions={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => downloadSalesReportPDF(filters).catch(() => toast.error('Failed to download PDF.'))}>⬇ PDF</button>
            <button className="btn btn-success btn-sm" onClick={() => downloadSalesReportExcel(filters).catch(() => toast.error('Failed to download Excel.'))}>⬇ Excel</button>
          </>
        }
      />
      <div className="page">

        {/* Filters */}
        <div className="card mb-2" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="form-group" style={{ minWidth: 240 }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              placeholder="Receipt, product, cashier..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" onClick={load}>Generate Report</button>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="stat-grid mb-2">
            <div className="stat-card">
              <div className="label">Transactions</div>
              <div className="value">{data.totals.transaction_count}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
              <div className="label">Total Qty Sold</div>
              <div className="value" style={{ color: 'var(--success)' }}>{totalQty.toFixed(2)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--accent)' }}>
              <div className="label">Grand Total</div>
              <div className="value" style={{ color: 'var(--accent)' }}>{formatCurrency(grandTotal, currency)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Line Items</div>
              <div className="value">{data.rows.length}</div>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? <Spinner /> : data && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* View toggle bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              background: '#f8fafc',
              flexWrap: 'wrap', gap: '0.75rem',
            }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {grouped
                  ? `${groupedRows.length} product${groupedRows.length !== 1 ? 's' : ''} — grouped view`
                  : `${data.rows.length} line item${data.rows.length !== 1 ? 's' : ''} — detailed view`}
              </span>

              {/* Toggle pills */}
              <div style={{
                display: 'inline-flex', borderRadius: 8,
                border: '1px solid var(--border)', overflow: 'hidden',
                background: 'var(--surface)',
              }}>
                <button
                  onClick={() => setGrouped(false)}
                  style={{
                    padding: '0.38rem 1rem', border: 'none', cursor: 'pointer',
                    fontSize: '0.82rem', fontWeight: 600,
                    background: !grouped ? 'var(--primary)' : 'transparent',
                    color:      !grouped ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  Detailed
                </button>
                <button
                  onClick={() => setGrouped(true)}
                  style={{
                    padding: '0.38rem 1rem', border: 'none', cursor: 'pointer',
                    fontSize: '0.82rem', fontWeight: 600,
                    background: grouped ? 'var(--primary)' : 'transparent',
                    color:      grouped ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                    borderLeft: '1px solid var(--border)',
                  }}
                >
                  By Product
                </button>
              </div>
            </div>

            {/* ── GROUPED view ── */}
            {grouped ? (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th style={{ textAlign: 'right' }}>Times Sold</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((r, i) => (
                    <tr key={r.product_code}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td><code>{r.product_code}</code></td>
                      <td>
                        <strong>{r.product_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.unit}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.unit_price, currency)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{r.total_qty.toFixed(2)}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 4 }}>{r.unit}</span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {r.transactions}×
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ color: 'var(--primary)' }}>{formatCurrency(r.total_amount, currency)}</strong>
                      </td>
                    </tr>
                  ))}
                  {groupedRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted" style={{ padding: '2rem' }}>
                        No sales data for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
                {groupedRows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>TOTALS</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>{totalQty.toFixed(2)}</td>
                      <td></td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>{formatCurrency(grandTotal, currency)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              /* ── DETAILED view ── */
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Receipt No.</th>
                    <th>Date & Time</th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th style={{ textAlign: 'right' }}>Qty Sold</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td><code style={{ fontSize: '0.8rem' }}>{r.receipt_number}</code></td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {formatDateTime(r.created_at)}
                      </td>
                      <td><code>{r.product_code}</code></td>
                      <td><strong>{r.product_name}</strong></td>
                      <td style={{ textAlign: 'right' }}>
                        {Number(r.quantity).toFixed(2)} <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.unit}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.unit_price, currency)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ color: 'var(--primary)' }}>{formatCurrency(r.amount, currency)}</strong>
                      </td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-muted" style={{ padding: '2rem' }}>
                        No sales data for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
                {data.rows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>TOTALS</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>{totalQty.toFixed(2)}</td>
                      <td></td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>{formatCurrency(grandTotal, currency)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
