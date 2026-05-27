import React from 'react';
import { useState, useEffect } from 'react';
import { getInventoryReport, downloadInventoryReportPDF, downloadInventoryReportExcel } from '../../services/reportService.js';
import PageHeader            from '../../components/PageHeader.jsx';
import Spinner               from '../../components/Spinner.jsx';
import StockReconciliation   from '../../components/StockReconciliation.jsx';
import toast                 from 'react-hot-toast';
import { formatCurrency, todayISO } from '../../utils/formatters.js';
import { useSettings } from '../../context/SettingsContext.jsx';

const STATUS_CLASS = {
  'OK':            'badge-success',
  'Low':           'badge-warning',
  'Zero':          'badge-danger',
  'Negative':      'badge-danger',
  'Zero Movement': 'badge-info',
};

const INVENTORY_COLUMNS = [
  { key: 'code', label: 'Product Code', align: 'left' },
  { key: 'name', label: 'Product Name', align: 'left' },
  { key: 'unit', label: 'Unit', align: 'left' },
  { key: 'opening', label: 'Opening Balance', align: 'right' },
  { key: 'purchased', label: 'Purchases / In', align: 'right' },
  { key: 'sold', label: 'Sales / Out', align: 'right' },
  { key: 'closing', label: 'Closing Stock', align: 'right' },
  { key: 'value', label: 'Stock Value', align: 'right' },
  { key: 'status', label: 'Status', align: 'center' },
];

export default function InventoryReport() {
  const { settings } = useSettings();
  const currency = settings.currency || 'GHS';
  const [rows, setRows]       = useState([]);
  const [period, setPeriod]   = useState({ from: todayISO(), to: todayISO() });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: todayISO(), to: todayISO() });
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    code: true,
    name: true,
    unit: true,
    opening: true,
    purchased: true,
    sold: true,
    closing: true,
    value: true,
    status: true,
  });

  const load = () => {
    setLoading(true);
    getInventoryReport(filters)
      .then((data) => {
        if (Array.isArray(data)) {
          setRows(data);
          setPeriod(filters);
        } else {
          setRows(data.rows || []);
          setPeriod(data.period || filters);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeColumns = INVENTORY_COLUMNS.filter((column) => visibleColumns[column.key]);
  const visibleRows = filtered;
  const downloadParams = {
    ...filters,
    columns: activeColumns.map((column) => column.key).join(','),
  };

  // Footer totals
  const totals = visibleRows.reduce((acc, r) => ({
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
        subtitle={`Opening + Purchases/In - Sales/Out = Closing (${period.from} to ${period.to})`}
        actions={
          <>
            <button className="btn btn-primary btn-sm" onClick={() => setReconcileOpen(true)}>
              ⚖ Stock Reconciliation
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => downloadInventoryReportPDF(downloadParams).catch(() => toast.error('Failed to download PDF.'))}>⬇ PDF</button>
            <button className="btn btn-success btn-sm" onClick={() => downloadInventoryReportExcel(downloadParams).catch(() => toast.error('Failed to download Excel.'))}>⬇ Excel</button>
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
        <div className="card mb-2" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group">
            <label className="form-label">From</label>
            <input
              type="date"
              className="form-input"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-input"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </div>
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
          <button className="btn btn-primary btn-sm" onClick={load}>Generate</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>
            ✕ Clear
          </button>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {INVENTORY_COLUMNS.map((column) => (
              <label key={column.key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={visibleColumns[column.key]}
                  onChange={() => setVisibleColumns({
                    ...visibleColumns,
                    [column.key]: !visibleColumns[column.key],
                  })}
                />
                {column.label}
              </label>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {visibleRows.length} of {filtered.length} products
          </span>
          <button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>
        </div>

        {/* Table */}
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {activeColumns.map((column) => (
                    <th key={column.key} style={{ textAlign: column.align || 'left' }}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => {
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
                      {activeColumns.map((column) => {
                        const value = (() => {
                          switch (column.key) {
                            case 'code': return <code>{r.code}</code>;
                            case 'name':
                              return (
                                <>
                                  <strong>{r.name}</strong>
                                  {!r.is_active && (
                                    <span className="badge badge-gray" style={{ fontSize: '0.68rem', marginLeft: 6 }}>inactive</span>
                                  )}
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.unit}</div>
                                </>
                              );
                            case 'unit': return r.unit;
                            case 'opening': return Number(r.opening).toFixed(2);
                            case 'purchased': return Number(r.purchased) > 0 ? `+${Number(r.purchased).toFixed(2)}` : '—';
                            case 'sold': return Number(r.sold) > 0 ? `−${Number(r.sold).toFixed(2)}` : '—';
                            case 'closing': return (
                              <strong style={{ color: closingColor, fontSize: '0.95rem' }}>
                                {Number(r.closing).toFixed(2)}
                              </strong>
                            );
                            case 'value': return <strong>{formatCurrency(r.closing_value, currency)}</strong>;
                            case 'status': return (
                              <span className={`badge ${STATUS_CLASS[r.status] || 'badge-gray'}`}>
                                {r.status}
                              </span>
                            );
                            default: return null;
                          }
                        })();
                        return (
                          <td key={column.key} style={{ textAlign: column.align || 'left' }}>
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={1 + activeColumns.length} className="text-center text-muted" style={{ padding: '2rem' }}>
                      No products match your filter.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totals footer */}
              {visibleRows.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>
                    <td colSpan={1 + activeColumns.filter((col) => !['opening', 'purchased', 'sold', 'closing', 'value'].includes(col.key)).length} style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>TOTALS</td>
                    {activeColumns.filter((col) => ['opening', 'purchased', 'sold', 'closing', 'value'].includes(col.key)).map((column) => (
                      <td key={column.key} style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                        {column.key === 'opening' && totals.opening.toFixed(2)}
                        {column.key === 'purchased' && `+${totals.purchased.toFixed(2)}`}
                        {column.key === 'sold' && `−${totals.sold.toFixed(2)}`}
                        {column.key === 'closing' && totals.closing.toFixed(2)}
                        {column.key === 'value' && formatCurrency(totals.value, currency)}
                      </td>
                    ))}
                    {activeColumns.some((col) => col.key === 'status') && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <StockReconciliation
        open={reconcileOpen}
        onClose={() => { setReconcileOpen(false); load(); }}
      />
    </div>
  );
}

