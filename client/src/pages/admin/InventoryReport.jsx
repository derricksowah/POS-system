import { useState, useEffect } from 'react';
import { getInventoryReport, downloadInventoryReportPDF, downloadInventoryReportExcel } from '../../services/reportService.js';
import PageHeader from '../../components/PageHeader.jsx';
import Spinner    from '../../components/Spinner.jsx';
import toast      from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatters.js';
import { useSettings } from '../../context/SettingsContext.jsx';

const STATUS_CLASS = {
  'OK':            'badge-success',
  'Low':           'badge-warning',
  'Zero':          'badge-danger',
  'Negative':      'badge-danger',
  'Zero Movement': 'badge-info',
};

export default function InventoryReport() {
  const { settings } = useSettings();
  const currency = settings.currency || 'GHS';
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    getInventoryReport().then(setRows).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Footer totals
  const totals = filtered.reduce((acc, r) => ({
    opening:   acc.opening   + Number(r.opening),
    purchased: acc.purchased + Number(r.purchased),
    sold:      acc.sold      + Number(r.sold),
    closing:   acc.closing   + Number(r.closing),
    value:     acc.value     + Number(r.closing_value),
  }), { opening: 0, purchased: 0, sold: 0, closing: 0, value: 0 });

  return (
    <div>
      <PageHeader
        title="Inventory Report"
        subtitle="Opening Balance + Purchases − Sales = Closing Stock"
        actions={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => downloadInventoryReportPDF().catch(() => toast.error('Failed to download PDF.'))}>⬇ PDF</button>
            <button className="btn btn-success btn-sm" onClick={() => downloadInventoryReportExcel().catch(() => toast.error('Failed to download Excel.'))}>⬇ Excel</button>
          </>
        }
      />
      <div className="page">

        {/* Status summary cards */}
        <div className="stat-grid mb-2">
          {[
            { label: 'OK',           color: 'var(--success)' },
            { label: 'Low',          color: 'var(--warning)' },
            { label: 'Zero',         color: 'var(--danger)'  },
            { label: 'Negative',     color: 'var(--danger)'  },
            { label: 'Zero Movement',color: '#6366f1'        },
          ].map(({ label, color }) => (
            <div
              key={label}
              className="stat-card"
              style={{ borderLeftColor: color, cursor: 'pointer', outline: statusFilter === label ? `2px solid ${color}` : 'none' }}
              onClick={() => setStatusFilter(statusFilter === label ? '' : label)}
              title={`Filter by: ${label}`}
            >
              <div className="label">{label}</div>
              <div className="value" style={{ color }}>{rows.filter((r) => r.status === label).length}</div>
            </div>
          ))}
        </div>

        {/* Search & filter bar */}
        <div className="card mb-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search by code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <select
            className="form-select"
            style={{ maxWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {['OK', 'Low', 'Zero', 'Negative', 'Zero Movement'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(search || statusFilter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>
              ✕ Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {filtered.length} of {rows.length} products
          </span>
          <button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>
        </div>

        {/* Table */}
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product Code</th>
                  <th>Product Name</th>
                  <th style={{ textAlign: 'right' }}>Opening Balance</th>
                  <th style={{ textAlign: 'right' }}>Purchases / In</th>
                  <th style={{ textAlign: 'right' }}>Sales / Out</th>
                  <th style={{ textAlign: 'right' }}>Closing Stock</th>
                  <th style={{ textAlign: 'right' }}>Stock Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const closing = Number(r.closing);
                  const closingColor = closing < 0
                    ? 'var(--danger)'
                    : closing === 0
                      ? 'var(--danger)'
                      : closing <= Number(r.threshold)
                        ? 'var(--warning)'
                        : 'var(--success)';

                  return (
                    <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.55 }}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td><code>{r.code}</code></td>
                      <td>
                        <strong>{r.name}</strong>
                        {!r.is_active && (
                          <span className="badge badge-gray" style={{ fontSize: '0.68rem', marginLeft: 6 }}>inactive</span>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.unit}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{Number(r.opening).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 500 }}>
                        {Number(r.purchased) > 0 ? `+${Number(r.purchased).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: Number(r.sold) > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {Number(r.sold) > 0 ? `−${Number(r.sold).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ color: closingColor, fontSize: '0.95rem' }}>
                          {Number(r.closing).toFixed(2)}
                        </strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{formatCurrency(r.closing_value, currency)}</strong>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_CLASS[r.status] || 'badge-gray'}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted" style={{ padding: '2rem' }}>
                      No products match your filter.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totals footer */}
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>
                    <td colSpan={3} style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>TOTALS</td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>{totals.opening.toFixed(2)}</td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>+{totals.purchased.toFixed(2)}</td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>−{totals.sold.toFixed(2)}</td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>{totals.closing.toFixed(2)}</td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>{formatCurrency(totals.value, currency)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
