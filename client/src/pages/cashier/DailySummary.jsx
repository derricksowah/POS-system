import { useState, useEffect } from 'react';
import { getTodaySummary } from '../../services/reportService.js';
import PageHeader           from '../../components/PageHeader.jsx';
import Spinner              from '../../components/Spinner.jsx';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { useSettings }      from '../../context/SettingsContext.jsx';

export default function DailySummary() {
  const { settings }         = useSettings();
  const currency             = settings.currency || 'GHS';
  const [data, setData]      = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getTodaySummary().then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const today = formatDate(new Date());

  return (
    <div>
      <PageHeader
        title="Today's Summary"
        subtitle={today}
        actions={<button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>}
      />
      <div className="page">
        {loading ? <Spinner /> : !data ? null : (
          <>
            {/* Summary cards */}
            <div className="stat-grid mb-3">
              <div className="stat-card">
                <div className="label">Transactions</div>
                <div className="value">{data.summary.total_transactions}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: 'var(--accent)' }}>
                <div className="label">Total Revenue</div>
                <div className="value" style={{ color: 'var(--accent)' }}>{formatCurrency(data.summary.total_value, currency)}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
                <div className="label">Units Sold</div>
                <div className="value" style={{ color: 'var(--success)' }}>{Number(data.summary.total_units).toFixed(0)}</div>
              </div>
            </div>

            {/* Product breakdown */}
            <div className="card">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--primary)' }}>Sales Breakdown by Product</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th>Code</th><th>Unit</th><th>Qty Sold</th><th>Avg Price</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.product_name}</strong></td>
                        <td><code>{r.product_code}</code></td>
                        <td>{r.unit}</td>
                        <td>{Number(r.total_qty).toFixed(2)}</td>
                        <td>{formatCurrency(r.avg_price, currency)}</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{formatCurrency(r.total_amount, currency)}</strong></td>
                      </tr>
                    ))}
                    {data.rows.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted" style={{ padding: '2rem' }}>No sales recorded today.</td></tr>
                    )}
                  </tbody>
                  {data.rows.length > 0 && (
                    <tfoot style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <tr>
                        <td colSpan={3} style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>TOTAL</td>
                        <td style={{ padding: '0.65rem 1rem' }}>{Number(data.summary.total_units).toFixed(2)}</td>
                        <td></td>
                        <td style={{ padding: '0.65rem 1rem', color: 'var(--primary)' }}>{formatCurrency(data.summary.total_value, currency)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
