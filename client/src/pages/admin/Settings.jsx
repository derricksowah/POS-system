import { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, uploadLogo, deleteLogo } from '../../services/settingsService.js';
import { changePassword }  from '../../services/authService.js';
import { listPrinters }    from '../../services/printService.js';
import { useSettings }     from '../../context/SettingsContext.jsx';
import PageHeader          from '../../components/PageHeader.jsx';
import { getErrorMessage } from '../../utils/formatters.js';
import toast from 'react-hot-toast';

export default function Settings() {
  const { setSettings }  = useSettings();
  const [form, setForm]  = useState({
    shop_name: '', shop_address: '', phone_number: '', phone_number_2: '',
    currency: 'GHS', receipt_header: '', receipt_footer: '', printer_name: '',
  });
  const [printerList, setPrinterList]     = useState([]);
  const [detectingPrinters, setDetecting] = useState(false);
  const [logoUrl, setLogoUrl]     = useState('');
  const [logoPreview, setLogoPreview] = useState(''); // local blob preview before upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef              = useRef(null);

  const [pwForm, setPwForm]   = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving]   = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (s) {
        setForm({
          shop_name:      s.shop_name      || '',
          shop_address:   s.shop_address   || '',
          phone_number:   s.phone_number   || '',
          phone_number_2: s.phone_number_2 || '',
          currency:       s.currency       || 'GHS',
          receipt_header: s.receipt_header || '',
          receipt_footer: s.receipt_footer || '',
          printer_name:   s.printer_name   || '',
        });
        setLogoUrl(s.logo_url || '');
      }
    });
  }, []);

  // ── Logo upload ───────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);

    setUploading(true);
    try {
      const data = await uploadLogo(file);
      setLogoUrl(data.logo_url);
      setSettings((prev) => ({ ...prev, logo_url: data.logo_url }));
      toast.success('Logo uploaded.');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setLogoPreview('');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      e.target.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    setUploading(true);
    try {
      await deleteLogo();
      setLogoUrl('');
      setLogoPreview('');
      setSettings((prev) => ({ ...prev, logo_url: '' }));
      toast.success('Logo removed.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  // ── Settings save ─────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const s = await updateSettings(form);
      // Merge back logo_url which is managed separately
      setSettings({ ...s, logo_url: logoUrl });
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Password change ───────────────────────────────────────────
  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(pwForm.current_password, pwForm.new_password);
      toast.success('Password changed successfully.');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  const handleDetectPrinters = async () => {
    setDetecting(true);
    try {
      const data = await listPrinters();
      setPrinterList(data.printers || []);
      if (!data.printers?.length) toast.error('No printers found. Make sure the printer is connected and powered on.');
      else toast.success(`${data.printers.length} printer(s) found.`);
    } catch {
      toast.error('Could not detect printers.');
    } finally {
      setDetecting(false);
    }
  };

  const CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP', 'NGN', 'KES', 'ZAR'];
  const displayLogo = logoPreview || logoUrl;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Shop configuration and account" />
      <div className="page" style={{ maxWidth: 760 }}>

        {/* Shop settings */}
        <div className="card mb-3">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--primary)' }}>Shop Settings</h2>
          <form onSubmit={handleSave}>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Shop Name *</label>
              <input className="form-input" value={form.shop_name}
                onChange={(e) => setForm({ ...form, shop_name: e.target.value })} required />
            </div>

            <div className="form-grid form-grid-2" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Phone Number 1</label>
                <input className="form-input" value={form.phone_number} placeholder="e.g. 0244000000"
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number 2</label>
                <input className="form-input" value={form.phone_number_2} placeholder="e.g. 0554000000"
                  onChange={(e) => setForm({ ...form, phone_number_2: e.target.value })} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Address</label>
              <input className="form-input" value={form.shop_address}
                onChange={(e) => setForm({ ...form, shop_address: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Currency</label>
              <select className="form-select" value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })} style={{ maxWidth: 160 }}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Receipt Header</label>
              <input className="form-input" value={form.receipt_header}
                onChange={(e) => setForm({ ...form, receipt_header: e.target.value })}
                placeholder="Text shown at top of receipt..." />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Receipt Footer</label>
              <input className="form-input" value={form.receipt_footer}
                onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
                placeholder="e.g. Thank you for shopping with us!" />
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* Logo upload — separate card, separate action */}
        <div className="card mb-3">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--primary)' }}>Shop Logo</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Shown on receipts and the login page. Max 2 MB — JPG, PNG, GIF, WEBP or SVG.
          </p>

          {/* Preview */}
          {displayLogo && (
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img
                src={displayLogo}
                alt="Shop logo"
                style={{ height: 80, maxWidth: 200, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4, background: '#f8fafc' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteLogo}
                disabled={uploading}
              >
                Remove Logo
              </button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : displayLogo ? '🖼 Change Logo' : '📁 Upload Logo'}
          </button>

          {uploading && (
            <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Uploading…
            </span>
          )}
        </div>

        {/* Thermal Printer */}
        <div className="card mb-3">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--primary)' }}>Thermal Printer</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Connect your USB thermal printer, then click <strong>Detect Printers</strong> to find it automatically.
          </p>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {/* Dropdown — populated after detect */}
            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <label className="form-label">Selected Printer</label>
              {printerList.length > 0 ? (
                <select
                  className="form-select"
                  value={form.printer_name}
                  onChange={(e) => setForm({ ...form, printer_name: e.target.value })}
                >
                  <option value="">— None —</option>
                  {printerList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={form.printer_name}
                  readOnly
                  placeholder="Click 'Detect Printers' to find connected printers"
                  style={{ background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'default' }}
                />
              )}
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDetectPrinters}
              disabled={detectingPrinters}
              style={{ flexShrink: 0, marginBottom: 0 }}
            >
              {detectingPrinters ? '🔍 Detecting…' : '🔍 Detect Printers'}
            </button>
          </div>

          {form.printer_name && (
            <div style={{
              marginTop: '0.75rem', padding: '0.5rem 0.75rem',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius)', fontSize: '0.83rem', color: '#166534',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <span>✓</span> Active printer: <strong>{form.printer_name}</strong>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Printer'}
            </button>
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--primary)' }}>Change Password</h2>
          <form onSubmit={handlePwChange} style={{ maxWidth: 380 }}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Current Password</label>
              <input type="password" className="form-input" value={pwForm.current_password}
                onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">New Password</label>
              <input type="password" className="form-input" value={pwForm.new_password} minLength={8}
                onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="form-input" value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={savingPw}>
              {savingPw ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
