import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { getDashboard, getDailyTrend } from '../../services/reportService.js';
import { getLowStock }  from '../../services/productService.js';
import PageHeader       from '../../components/PageHeader.jsx';
import Spinner          from '../../components/Spinner.jsx';
import { formatCurrency, formatDateTime } from '../../utils/formatters.js';
import { useSettings }  from '../../context/SettingsContext.jsx';

const RANGE_OPTIONS = [
  { label: '7 days',  value: 7  },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
];

// Format "2025-04-09" → "Apr 09"
function fmtDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// Custom tooltip shown when hovering a bar
function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const isToday = d?.date === new Date().toISOString().slice(0, 10);
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 8, padding: '0.75rem 1rem',
      boxShadow: '0 4px 12px rgba(0,0,0,.12)', fontSize: '0.85rem', minWidth: 170,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary)' }}>
        {fmtDay(d.date)} {isToday && <span style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>TODAY</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
        <span style={{ color: 'var(--text-muted)' }}>Revenue</span>
        <strong>{formatCurrency(d.revenue, currency)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
        <span style={{ color: 'var(--text-muted)' }}>Transactions</span>
        <strong>{d.transactions}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: 'var(--text-muted)' }}>Units Sold</span>
        <strong>{Number(d.units_sold).toFixed(0)}</strong>
      </div>
    </div>
  );
}

// Generate 30 days of realistic-looking sample data ending today
function buildSample(numDays) {
  const today = new Date();
  const data = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const isWeekend  = dow === 0 || dow === 6;
    const isToday    = i === 0;
    // Weekends busier; sprinkle some zero days; today has partial sales
    const base = isWeekend ? 850 : 520;
    const noise = (Math.sin(i * 7.3) + Math.cos(i * 3.1)) * 180;
    const rev = isToday
      ? Math.round((base + noise) * 0.4)  // partial day
      : i % 9 === 0
        ? 0                               // occasional closed day
        : Math.max(0, Math.round(base + noise));
    const txns = rev === 0 ? 0 : Math.max(1, Math.round(rev / 95));
    data.push({ date: dateStr, revenue: rev, transactions: txns, units_sold: txns * 3 });
  }
  return data;
}

export default function Dashboard() {
  const { settings }        = useSettings();
  const currency            = settings.currency || 'GHS';
  const [stats, setStats]   = useState(null);
  const [low, setLow]       = useState([]);
  const [days, setDays]     = useState(30);
  const [trend, setTrend]   = useState(() => buildSample(30)); // show sample immediately
  const [isSample, setIsSample]         = useState(true);
  const [loading, setLoading]           = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  // Load stats + low stock once
  useEffect(() => {
    Promise.all([getDashboard(), getLowStock()])
      .then(([s, l]) => { setStats(s); setLow(l); })
      .finally(() => setLoading(false));
  }, []);

  // Reload chart when range changes
  useEffect(() => {
    setChartLoading(true);
    getDailyTrend(days)
      .then((data) => {
        setTrend(data);
        setIsSample(false);
      })
      .catch(() => {
        // API not reachable — keep showing sample
        setTrend(buildSample(days));
        setIsSample(true);
      })
      .finally(() => setChartLoading(false));
  }, [days]);

  // Compute avg and best day for annotation
  const nonZeroDays  = trend.filter((d) => d.revenue > 0);
  const avgRevenue   = nonZeroDays.length
    ? nonZeroDays.reduce((s, d) => s + d.revenue, 0) / nonZeroDays.length
    : 0;
  const bestDay      = trend.reduce((best, d) => d.revenue > (best?.revenue ?? 0) ? d : best, null);
  const today        = new Date().toISOString().slice(0, 10);
  const todayData    = trend.find((d) => d.date === today);

  // Color each bar: today = accent, best = green, zero = light gray, rest = primary
  const chartData = trend.map((d) => ({
    ...d,
    fill: d.date === today
      ? '#f59e0b'
      : d.revenue === 0
        ? '#e2e8f0'
        : d.date === bestDay?.date
          ? '#15803d'
          : '#2e5490',
  }));

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Updated: ${formatDateTime(new Date())}`} />
      <div className="page">

        {/* ── Stat cards ─────────────────────────────────────────── */}
        <div className="stat-grid mb-3">
          <div className="stat-card">
            <div className="label">Total Products</div>
            <div className="value">{stats?.total_products ?? 0}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
            <div className="label">Today's Sales</div>
            <div className="value" style={{ color: 'var(--success)' }}>{stats?.today_sales_count ?? 0}</div>
            <div className="sub">{formatCurrency(stats?.today_sales_value, currency)}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--accent)' }}>
            <div className="label">All-Time Revenue</div>
            <div className="value" style={{ color: 'var(--accent)' }}>{formatCurrency(stats?.all_time_sales_value, currency)}</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
            <div className="label">Low Stock Alerts</div>
            <div className="value" style={{ color: 'var(--danger)' }}>
              {stats?.low_stock_count ?? 0}
            </div>
            <div className="sub">products need restocking</div>
          </div>
        </div>

        {/* ── Daily Sales Chart ───────────────────────────────────── */}
        <div className="card mb-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>Daily Sales Trend</h2>
                {isSample && (
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px',
                    background: '#fef3c7', color: '#92400e',
                    borderRadius: 99, border: '1px solid #fde68a',
                  }}>
                    SAMPLE DATA
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Revenue per day — hover a bar for details
              </p>
            </div>

            {/* Range picker */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className="btn btn-sm"
                  style={{
                    background: days === opt.value ? 'var(--primary)' : 'var(--bg)',
                    color:      days === opt.value ? '#fff' : 'var(--text-muted)',
                    border:     `1px solid ${days === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend pills */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { color: '#f59e0b', label: 'Today' },
              { color: '#15803d', label: `Best day${bestDay ? ` (${fmtDay(bestDay.date)})` : ''}` },
              { color: '#2e5490', label: 'Revenue (bar)' },
              { color: '#f97316', label: 'Transactions (line)' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>

          {/* Summary pills */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Avg/day: </span>
              <strong>{formatCurrency(avgRevenue, currency)}</strong>
            </div>
            {bestDay && (
              <div style={{ fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Best day: </span>
                <strong style={{ color: 'var(--success)' }}>{fmtDay(bestDay.date)} — {formatCurrency(bestDay.revenue, currency)}</strong>
              </div>
            )}
            {todayData && (
              <div style={{ fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Today vs avg: </span>
                <strong style={{ color: todayData.revenue >= avgRevenue ? 'var(--success)' : 'var(--danger)' }}>
                  {todayData.revenue >= avgRevenue ? '▲' : '▼'}{' '}
                  {avgRevenue > 0
                    ? `${Math.abs(((todayData.revenue - avgRevenue) / avgRevenue) * 100).toFixed(1)}%`
                    : '—'}
                </strong>
              </div>
            )}
          </div>

          {chartLoading ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Loading chart…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDay}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  interval={days <= 14 ? 0 : days <= 30 ? 2 : 6}
                />
                <YAxis
                  yAxisId="revenue"
                  tickFormatter={(v) => v === 0 ? '0' : `${(v / 1000).toFixed(1)}k`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <YAxis
                  yAxisId="txns"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: 'rgba(30,58,95,0.06)' }} />
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  name="Revenue"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  fill="#2e5490"
                  isAnimationActive={true}
                  animationDuration={600}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
                <Line
                  yAxisId="txns"
                  type="monotone"
                  dataKey="transactions"
                  name="Transactions"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f97316' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Restock list ─────────────────────────────────────────── */}
        <div className="card" style={{ borderTop: `3px solid var(--danger)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger)' }}>
                Products Needing Restock
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {low.length === 0
                  ? 'All products are well-stocked'
                  : `${low.length} product${low.length !== 1 ? 's' : ''} at or below restock threshold`}
              </p>
            </div>
            {low.length === 0 && (
              <span style={{ fontSize: '1.5rem' }}>✅</span>
            )}
          </div>

          {low.length === 0 ? (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius)', padding: '1rem 1.25rem',
              fontSize: '0.88rem', color: 'var(--success)', fontWeight: 500,
            }}>
              No products require restocking at this time.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Product</th>
                    <th>Unit</th>
                    <th>Stock Level</th>
                    <th style={{ textAlign: 'right' }}>Current</th>
                    <th style={{ textAlign: 'right' }}>Threshold</th>
                    <th style={{ textAlign: 'right' }}>Restock Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {low.map((p) => {
                    const current   = Number(p.current_stock);
                    const threshold = Number(p.low_stock_threshold);
                    // Suggested restock: bring up to 2× threshold, minimum 1
                    const restock   = Math.max(threshold * 2 - current, 1);
                    // Progress bar: 0–100% relative to threshold
                    const pct       = threshold > 0 ? Math.min((current / threshold) * 100, 100) : 0;
                    const isOut     = current === 0;
                    const barColor  = isOut ? 'var(--danger)' : 'var(--warning)';

                    return (
                      <tr key={p.id} style={{ background: isOut ? '#fff5f5' : 'inherit' }}>
                        <td><code>{p.code}</code></td>
                        <td><strong>{p.name}</strong></td>
                        <td style={{ color: 'var(--text-muted)' }}>{p.unit}</td>
                        <td style={{ minWidth: 120 }}>
                          <div style={{ background: '#e2e8f0', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: barColor,
                              borderRadius: 99,
                              transition: 'width 0.4s',
                            }} />
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            {pct.toFixed(0)}% of threshold
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: barColor }}>{current}</strong>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{threshold}</td>
                        <td style={{ textAlign: 'right' }}>
                          <strong style={{ color: 'var(--primary)' }}>+{restock}</strong>
                        </td>
                        <td>
                          <span className={`badge ${isOut ? 'badge-danger' : 'badge-warning'}`}>
                            {isOut ? 'OUT OF STOCK' : 'LOW'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
