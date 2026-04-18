import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getProducts } from '../../services/productService.js';
import { createSale } from '../../services/salesService.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSettings } from '../../services/settingsService.js';
import { printReceiptById, listPrinters } from '../../services/printService.js';
import { formatCurrency, getErrorMessage } from '../../utils/formatters.js';
import toast from 'react-hot-toast';

export default function POS() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const currency = settings.currency || 'GHS';

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [alertOpen, setAlertOpen] = useState(true);
  const searchRef = useRef(null);
  const [cashierPrinter, setCashierPrinter] = useState('');
  const [printerList, setPrinterList] = useState([]);
  const [detectingPrinters, setDetecting] = useState(false);
  const [printerSectionOpen, setPrinterSectionOpen] = useState(false);

  useEffect(() => {
    getProducts({ limit: 500 }).then(({ products: p }) => setProducts(p));
    searchRef.current?.focus();
  }, []);

  // Low stock alerts
  const lowStockItems = useMemo(() =>
    products.filter((p) => Number(p.current_stock) <= Number(p.low_stock_threshold)),
    [products]);

  // Filtered product list — show all when no search, filter when typing
  const filtered = search.trim()
    ? products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
    )
    : products;

  // Cart helpers
  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: Number((i.quantity + 1).toFixed(4)) }
            : i
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        unit: product.unit,
        unit_price: Number(product.price),
        quantity: 1,
        current_stock: Number(product.current_stock),
      }];
    });
    setSearch('');
    searchRef.current?.focus();
  }, []);

  const updateQty = (productId, qty) => {
    const q = Number(qty);
    if (q <= 0) {
      setCart((prev) => prev.filter((i) => i.product_id !== productId));
    } else {
      setCart((prev) => prev.map((i) => i.product_id === productId ? { ...i, quantity: q } : i));
    }
  };

  const removeItem = (productId) => setCart((prev) => prev.filter((i) => i.product_id !== productId));
  const clearCart = () => { setCart([]); setSearch(''); searchRef.current?.focus(); };

  const handleDetectPrinters = async () => {
    setDetecting(true);
    try {
      const data = await listPrinters();
      setPrinterList(data.printers || []);
      if (!data.printers?.length) toast.error('No printers found.');
      else toast.success(`${data.printers.length} printer(s) found.`);
    } catch {
      toast.error('Could not detect printers.');
    } finally {
      setDetecting(false);
    }
  };

  const grandTotal = cart.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  // Validate stock before confirming
  const validate = () => {
    for (const item of cart) {
      if (item.quantity > item.current_stock) {
        toast.error(`Insufficient stock for "${item.product_name}". Available: ${item.current_stock}`);
        return false;
      }
    }
    return true;
  };

  const confirmSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty.'); return; }
    if (!validate()) return;
    const activePrinter = cashierPrinter || settings.printer_name;
    if (!activePrinter) {
      toast.error('❌ No printer selected. Click the printer section to detect and select one.');
      return;
    }

    setConfirming(true);
    // Snapshot cart before clearing so we can deduct stock optimistically
    const soldItems = [...cart];
    try {
      const [sale, freshSettings] = await Promise.all([
        createSale(soldItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price }))),
        getSettings(),
      ]);
      sale.cashier_name = user.username;
      setLastSale(sale);
      clearCart();

      // ── Optimistic UI update ──────────────────────────────────────────────
      // Immediately deduct sold quantities from local state so stock counts,
      // OUT badges, and the low-stock alert bar all reflect the sale at once.
      setProducts((prev) =>
        prev.map((p) => {
          const sold = soldItems.find((i) => i.product_id === p.id);
          if (!sold) return p;
          return {
            ...p,
            current_stock: Math.max(0, Number(p.current_stock) - Number(sold.quantity)),
          };
        })
      );

      // Authoritative re-fetch in background to sync any server-side values
      getProducts({ limit: 500 }).then(({ products: p }) => setProducts(p));

      toast.success(`Sale confirmed! Receipt: ${sale.receipt_number}`);
      // Auto-print directly to thermal printer (silent, no dialog)
      printReceiptById(sale.id).catch(() => {
        toast.error('Printer not ready — please ensure it is connected and powered on.');
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setConfirming(false);
    }
  };

  const handleReprint = () => {
    if (!lastSale) return;
    printReceiptById(lastSale.id).catch(() => {
      toast.error('Printer not ready — please ensure it is connected and powered on.');
    });
  };

  return (
    <div className="pos-shell">

      {/* LEFT — Product search */}
      <div className="pos-products-panel">
        <div style={{ padding: '1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem' }}>
            🛒 Point of Sale
          </h1>
          <input
            ref={searchRef}
            className="form-input"
            placeholder="Filter by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: '1rem', padding: '0.65rem 1rem' }}
          />
        </div>

        {/* Low stock alert bar */}
        {lowStockItems.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--border)', background: '#fff8f0' }}>
            <button
              onClick={() => setAlertOpen((o) => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                color: '#92400e', fontWeight: 700, fontSize: '0.8rem',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem' }}>⚠</span>
                {lowStockItems.length} product{lowStockItems.length !== 1 ? 's' : ''} low / out of stock
              </span>
              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{alertOpen ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {alertOpen && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', padding: '0 1rem 0.6rem' }}>
                {lowStockItems.map((p) => {
                  const out = Number(p.current_stock) <= 0;
                  return (
                    <span
                      key={p.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600,
                        background: out ? '#fee2e2' : '#fef3c7',
                        color: out ? '#b91c1c' : '#92400e',
                        border: `1px solid ${out ? '#fca5a5' : '#fcd34d'}`,
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: out ? '#ef4444' : '#f59e0b',
                        display: 'inline-block', flexShrink: 0,
                      }} />
                      {p.name}
                      <span style={{ opacity: 0.7, fontWeight: 400 }}>
                        {out ? '· OUT' : `· ${p.current_stock} left`}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem' }}>
          {filtered.length === 0 && search.trim() ? (
            <p className="text-muted text-center" style={{ marginTop: '2rem' }}>No products found for "{search}"</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '0.6rem' }}>
              {filtered.map((p) => {
                const outOfStock = Number(p.current_stock) <= 0;
                const lowStock = !outOfStock && Number(p.current_stock) <= Number(p.low_stock_threshold);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={outOfStock}
                    style={{
                      background: outOfStock ? 'var(--bg)' : 'var(--surface)',
                      border: `1.5px solid ${outOfStock ? 'var(--border)' : lowStock ? 'var(--warning)' : 'var(--primary)'}`,
                      borderRadius: 'var(--radius)', padding: '0.75rem',
                      cursor: outOfStock ? 'not-allowed' : 'pointer',
                      textAlign: 'left', transition: 'all 0.15s',
                      opacity: outOfStock ? 0.55 : 1,
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => { if (!outOfStock) e.currentTarget.style.background = '#e8f0fe'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = outOfStock ? 'var(--bg)' : 'var(--surface)'; }}
                  >
                    {outOfStock && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'var(--danger)', color: '#fff',
                        fontSize: '0.6rem', fontWeight: 700,
                        padding: '1px 5px', borderRadius: 4, letterSpacing: '0.03em',
                      }}>OUT</span>
                    )}
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.3, paddingRight: outOfStock ? 28 : 0 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.code}</div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                        {formatCurrency(p.price, currency)}
                      </span>
                      {!outOfStock && (
                        <span style={{ fontSize: '0.72rem', color: lowStock ? 'var(--warning)' : 'var(--text-muted)', fontWeight: lowStock ? 600 : 400 }}>
                          {p.current_stock} {p.unit}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className="pos-cart-panel">
        {/* Cart header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Cart ({cart.length} items)</span>
          {cart.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearCart} style={{ color: 'var(--danger)' }}>Clear</button>
          )}
        </div>

        {/* Printer Selection Section */}
        <div style={{
          padding: '0.75rem 1rem',
          background: '#f8f9fa',
          borderBottom: '1px solid var(--border)'
        }}>
          <button
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
              color: 'var(--text)',
              fontSize: '0.9rem'
            }}
            onClick={() => setPrinterSectionOpen(!printerSectionOpen)}
          >
            <span>🖨️ Printer: {cashierPrinter || settings.printer_name || 'Not selected'}</span>
            <span style={{ fontSize: '0.75rem' }}>{printerSectionOpen ? '▼' : '▶'}</span>
          </button>

          {printerSectionOpen && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Select Printer for This Session
                </label>
                {printerList.length > 0 ? (
                  <select
                    className="form-select"
                    value={cashierPrinter}
                    onChange={(e) => setCashierPrinter(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">— Use shop default —</option>
                    {printerList.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    value={cashierPrinter}
                    readOnly
                    placeholder="Click 'Detect' to find printers"
                    style={{ fontSize: '0.85rem', background: 'var(--bg)', color: 'var(--text-muted)' }}
                  />
                )}
              </div>

              <button
                className="btn btn-outline btn-sm"
                onClick={handleDetectPrinters}
                disabled={detectingPrinters}
              >
                {detectingPrinters ? '🔍 Detecting...' : '🔍 Detect Printers'}
              </button>

              {cashierPrinter && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.75rem',
                  color: '#166534'
                }}>
                  ✓ Using: <strong>{cashierPrinter}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
          {cart.length === 0 ? (
            <div className="text-center text-muted" style={{ marginTop: '2rem', padding: '1rem' }}>
              <div style={{ fontSize: '2rem' }}>🛒</div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.88rem' }}>Cart is empty.<br />Search and select products.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} style={{
                padding: '0.6rem 0.5rem', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.product_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatCurrency(item.unit_price, currency)} / {item.unit}
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.product_id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>✕</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                  {/* Quantity control */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      onClick={() => updateQty(item.product_id, item.quantity - 1)}
                      style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}
                    >−</button>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateQty(item.product_id, e.target.value)}
                      style={{ width: 60, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.88rem' }}
                    />
                    <button
                      onClick={() => updateQty(item.product_id, item.quantity + 1)}
                      disabled={item.quantity >= item.current_stock}
                      style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}
                    >+</button>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                    {formatCurrency(item.quantity * item.unit_price, currency)}
                  </span>
                </div>

                {/* Stock warning */}
                {item.quantity > item.current_stock && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 3 }}>
                    ⚠ Exceeds available stock ({item.current_stock})
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Cart footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary)' }}>
              {formatCurrency(grandTotal, currency)}
            </span>
          </div>

          <button
            className="btn btn-success btn-block btn-lg"
            onClick={confirmSale}
            disabled={cart.length === 0 || confirming}
          >
            {confirming ? '⏳ Processing...' : '✓ Confirm Sale'}
          </button>

          {/* Receipt actions for last sale */}
          {lastSale && (
            <div style={{ marginTop: '0.5rem' }}>
              <button
                className="btn btn-outline btn-sm btn-block"
                onClick={handleReprint}
                title="Reprint receipt"
              >
                🖨️ Reprint
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
