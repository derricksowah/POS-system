import React from 'react';
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader.jsx';
import Spinner from '../../components/Spinner.jsx';
import { getProfitabilityReport } from '../../services/reportService.js';
import { downloadProfitabilityReportPDF, downloadProfitabilityReportExcel } from '../../services/reportService.js';
import { formatCurrency, todayISO } from '../../utils/formatters.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import toast from 'react-hot-toast';

export default function ProfitabilityReport() {
  const { settings } = useSettings();
  const currency = settings.currency || 'GHS';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: todayISO(), to: todayISO(), search: '' });

  const load = () => {
    setLoading(true);
    getProfitabilityReport(filters)
      .then(setData)
      .catch(() => toast.error('Failed to load profitability report.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const rows = data?.rows ?? [];
  const totalQty = rows.reduce((sum, row) => sum + Number(row.quantity_sold || 0), 0);
  const totalProfit = rows.reduce((sum, row) => sum + (row.profit == null ? 0 : Number(row.profit)), 0);
  const costMissing = rows.filter((row) => row.cost_price == null).length;

  return (
    <div>
      <PageHeader
        title="Profitability Report"
        actions={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => downloadProfitabilityReportPDF(filters).catch(() => toast.error('Failed to download profitability PDF.'))}>
              ⬇ PDF
            </button>
            <button className="btn btn-success btn-sm" onClick={() => downloadProfitabilityReportExcel(filters).catch(() => toast.error('Failed to download profitability Excel.'))}>
              ⬇ Excel
            </button>
          </>
        }
      />
      <div className="page">
        <div className="card mb-2" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="form-group" style={{ minWidth: 240 }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              placeholder="Search by product name or code"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" onClick={load}>Generate Report</button>
        </div>

        {data && (
          <div className="stat-grid mb-2">
            <div className="stat-card">
              <div className="label">Products Sold</div>
              <div className="value">{rows.length}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
              <div className="label">Total Qty Sold</div>
              <div className="value" style={{ color: 'var(--success)' }}>{totalQty.toFixed(2)}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--accent)' }}>
              <div className="label">Total Profit</div>
              <div className="value" style={{ color: 'var(--accent)' }}>{formatCurrency(totalProfit, currency)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Cost Not Set</div>
              <div className="value">{costMissing}</div>
              <div className="sub">products need a cost price</div>
            </div>
          </div>
        )}

        {costMissing > 0 && (
          <div className="card mb-2" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}>
            Products without a cost price are shown with no profit calculation until a cost is set on the product page.
          </div>
        )}

        {loading ? <Spinner /> : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product ID</th>
                  <th>Product Name</th>
                  <th style={{ textAlign: 'right' }}>Margin</th>
                  <th style={{ textAlign: 'right' }}>Quantity Sold</th>
                  <th style={{ textAlign: 'right' }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.product_id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{index + 1}</td>
                    <td><code>{row.product_id}</code></td>
                    <td><strong>{row.product_name}</strong></td>
                    <td style={{ textAlign: 'right' }}>
                      {row.margin == null ? '—' : formatCurrency(Number(row.margin), currency)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{Number(row.quantity_sold || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {row.profit == null ? '—' : <strong style={{ color: 'var(--primary)' }}>{formatCurrency(Number(row.profit), currency)}</strong>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted" style={{ padding: '2rem' }}>
                      No profitability data for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

