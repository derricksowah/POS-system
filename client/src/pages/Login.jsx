import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/formatters.js';

export default function Login() {
  const { login, loading } = useAuth();
  const { settings }       = useSettings();
  const navigate           = useNavigate();
  const [form, setForm]    = useState({ username: '', password: '' });
  const [err, setErr]      = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const user = await login(form.username, form.password);
      toast.success(`Welcome back, ${user.username}!`);
      navigate(user.role === 'admin' ? '/admin' : '/pos');
    } catch (error) {
      setErr(getErrorMessage(error));
    }
  };

  const shopName = 'DDC Enterprise';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      position: 'relative',
      overflow: 'hidden',
      padding: '1.5rem',
    }}>

      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
        top: -200, left: -100, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
        bottom: -100, right: -50, pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 420,
        padding: '2.5rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>

        {/* Logo + Shop name inside the card */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="logo" style={{
              height: 64, marginBottom: '1rem', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem', fontWeight: 800, margin: '0 auto 1rem',
              boxShadow: '0 8px 32px rgba(37,99,235,0.4)',
            }}>
              {shopName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            {shopName}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem' }}>
            Point of Sale Management System
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.75rem' }} />

        {/* Error */}
        {err && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem',
            marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <span>⚠</span> {err}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.06em' }}>
              USERNAME
            </label>
            <input
              className="form-input"
              autoFocus
              autoComplete="username"
              placeholder="Enter your username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1.5px solid rgba(255,255,255,0.12)',
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.06em' }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                className="form-input"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  color: '#fff', paddingRight: '2.8rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', padding: 4,
                }}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.25rem',
              padding: '0.85rem',
              background: loading ? 'rgba(37,99,235,0.5)' : 'var(--primary)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: '0.95rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
              transition: 'all 0.18s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Signing in…
              </>
            ) : (
              'Sign In →'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.18)' }}>
          {shopName} · {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .form-input::placeholder { color: rgba(255,255,255,0.25) !important; }
        .form-input:focus { border-color: rgba(37,99,235,0.6) !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.15) !important; }
      `}</style>
    </div>
  );
}
