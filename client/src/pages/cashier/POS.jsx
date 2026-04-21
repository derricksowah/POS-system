import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getProducts } from '../../services/productService.js';
import { createSale } from '../../services/salesService.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSettings } from '../../services/settingsService.js';
import { printReceipt } from '../../print/printReceipt.js';
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
  const [amountTendered, setAmountTendered] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

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
            ? { ...i, quantity: Number((i.quantity + 0.5).toFixed(1)) }
            : i
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        unit: product.unit,
        unit_price: Number(product.price),
        quantity: 0.5,
        current_stock: Number(product.current_stock),
      }];
    });
    setSearch('');
    searchRef.current?.focus();
  }, []);

  const validateQuantity = (q) => {
    const num = Number(q);
    // Check if it's a whole number or ends in .5
    return num === Math.floor(num) || num === Math.floor(num) + 0.5;
  };

  const updateQty = (productId, qty) => {
    const q = Number(qty);
    if (q <= 0) {
      setCart((prev) => prev.filter((i) => i.product_id !== productId));
    } else if (validateQuantity(q)) {
      setCart((prev) => prev.map((i) => i.product_id === productId ? { ...i, quantity: q } : i));
    }
  };

  const removeItem = (productId) => setCart((prev) => prev.filter((i) => i.product_id !== productId));
  const clearCart = () => { setCart([]); setSearch(''); setAmountTendered(''); setPaymentMethod('cash'); searchRef.current?.focus(); };

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
    if (paymentMethod === 'cash' && (amountTendered === '' || Number(amountTendered) <= 0)) {
      toast.error('Please enter the cash amount tendered.'); return;
    }
    if (paymentMethod === 'cash' && Number(amountTendered) < grandTotal) {
      toast.error('Cash tendered is less than the total amount.'); return;
    }

    setConfirming(true);
    const soldItems = [...cart];
    try {
      const tendered = paymentMethod === 'cash' ? Number(amountTendered) : null;
      const [sale, freshSettings] = await Promise.all([
        createSale(
          soldItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
          tendered,
          paymentMethod
        ),
        getSettings(),
      ]);
      sale.cashier_name = user.username;
      setLastSale(sale);
      clearCart();

      setProducts((prev) =>
        prev.map((p) => {
          const sold = soldItems.find((i) => i.product_id === p.id);
          if (!sold) return p;
          return { ...p, current_stock: Math.max(0, Number(p.current_stock) - Number(sold.quantity)) };
        })
      );
      getProducts({ limit: 500 }).then(({ products: p }) => setProducts(p));

      toast.success(`Sale confirmed! Receipt: ${sale.receipt_number}`);
      printReceipt(sale, freshSettings);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setConfirming(false);
    }
  };

  const handleReprint = () => {
    if (!lastSale) return;
    printReceipt(lastSale, settings);
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
                      onClick={() => updateQty(item.product_id, Number((item.quantity - 0.5).toFixed(1)))}
                      style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}
                    >−</button>
                    <input
                      type="number" min="0.5" step="0.5"
                      value={item.quantity}
                      onChange={(e) => updateQty(item.product_id, e.target.value)}
                      style={{ width: 60, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.88rem' }}
                    />
                    <button
                      onClick={() => updateQty(item.product_id, Number((item.quantity + 0.5).toFixed(1)))}
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

          {/* Payment method + cash tendered */}
          {cart.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              {/* Payment toggle */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                {['cash', 'momo'].map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    style={{
                      flex: 1, padding: '0.45rem', fontWeight: 700, fontSize: '0.85rem',
                      border: `2px solid ${paymentMethod === method ? (method === 'momo' ? '#f59e0b' : 'var(--primary)') : 'var(--border)'}`,
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: paymentMethod === method ? (method === 'momo' ? '#fef3c7' : '#e8f0fe') : 'var(--bg)',
                      color: paymentMethod === method ? (method === 'momo' ? '#92400e' : 'var(--primary)') : 'var(--text-muted)',
                    }}
                  >
                    {method === 'cash' ? '💵 Cash' : '📱 MoMo'}
                  </button>
                ))}
              </div>

              {/* Cash tendered — greyed out for MoMo */}
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: paymentMethod === 'momo' ? 'var(--text-muted)' : 'var(--text)', display: 'block', marginBottom: '0.3rem' }}>
                Cash Tendered ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={paymentMethod === 'momo' ? '' : amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                disabled={paymentMethod === 'momo'}
                style={{
                  width: '100%', padding: '0.5rem 0.6rem', fontSize: '1rem',
                  border: '1.5px solid var(--border)', borderRadius: 'var(--radius)',
                  textAlign: 'right', fontWeight: 600,
                  background: paymentMethod === 'momo' ? 'var(--bg)' : '#fff',
                  color: paymentMethod === 'momo' ? 'var(--text-muted)' : 'var(--text)',
                  cursor: paymentMethod === 'momo' ? 'not-allowed' : 'text',
                }}
              />
              {paymentMethod === 'cash' && amountTendered !== '' && Number(amountTendered) >= grandTotal && (
                <div style={{
                  marginTop: '0.4rem', padding: '0.4rem 0.6rem',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 'var(--radius)', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>Change</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#166534' }}>
                    {formatCurrency(Number(amountTendered) - grandTotal, currency)}
                  </span>
                </div>
              )}
              {paymentMethod === 'cash' && amountTendered !== '' && Number(amountTendered) > 0 && Number(amountTendered) < grandTotal && (
                <div style={{
                  marginTop: '0.4rem', padding: '0.4rem 0.6rem',
                  background: '#fff7ed', border: '1px solid #fed7aa',
                  borderRadius: 'var(--radius)', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#9a3412' }}>Short by</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#9a3412' }}>
                    {formatCurrency(grandTotal - Number(amountTendered), currency)}
                  </span>
                </div>
              )}
              {paymentMethod === 'momo' && (
                <div style={{
                  marginTop: '0.4rem', padding: '0.4rem 0.6rem',
                  background: '#fef3c7', border: '1px solid #fcd34d',
                  borderRadius: 'var(--radius)', fontSize: '0.82rem', fontWeight: 600, color: '#92400e',
                }}>
                  📱 MoMo payment — no change required
                </div>
              )}
            </div>
          )}

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
