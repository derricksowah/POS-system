import { useState, useEffect } from 'react';
import {
  getUsers, createUser, changeUsername,
  adminChangePassword, toggleUserActive,
} from '../../services/userService.js';
import { useAuth }     from '../../context/AuthContext.jsx';
import PageHeader      from '../../components/PageHeader.jsx';
import Modal           from '../../components/Modal.jsx';
import ConfirmDialog   from '../../components/ConfirmDialog.jsx';
import Spinner         from '../../components/Spinner.jsx';
import { getErrorMessage } from '../../utils/formatters.js';
import toast from 'react-hot-toast';

const EMPTY_CREATE = { username: '', password: '', confirmPassword: '', role: 'cashier' };

export default function UserManagement() {
  const { user: me }           = useAuth();
  const [users, setUsers]      = useState([]);
  const [loading, setLoading]  = useState(true);

  // Create modal
  const [createOpen, setCreateOpen]   = useState(false);
  const [createForm, setCreateForm]   = useState(EMPTY_CREATE);
  const [creating, setCreating]       = useState(false);

  // Edit username modal
  const [unameOpen, setUnameOpen]     = useState(false);
  const [unameTarget, setUnameTarget] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [savingUname, setSavingUname] = useState(false);

  // Edit password modal
  const [pwOpen, setPwOpen]           = useState(false);
  const [pwTarget, setPwTarget]       = useState(null);
  const [newPw, setNewPw]             = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [savingPw, setSavingPw]       = useState(false);
  const [showPw, setShowPw]           = useState(false);

  // Toggle active confirm
  const [toggleConfirm, setToggleConfirm] = useState({ open: false, user: null });

  const load = () => {
    setLoading(true);
    getUsers().then(setUsers).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Create user ───────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (createForm.password !== createForm.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setCreating(true);
    try {
      await createUser({ username: createForm.username, password: createForm.password, role: createForm.role });
      toast.success(`User "${createForm.username}" created.`);
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // ── Change username ───────────────────────────────────────────
  const openUnameModal = (u) => { setUnameTarget(u); setNewUsername(u.username); setUnameOpen(true); };
  const handleChangeUsername = async (e) => {
    e.preventDefault();
    setSavingUname(true);
    try {
      await changeUsername(unameTarget.id, newUsername);
      toast.success('Username updated. User must log in again.');
      setUnameOpen(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingUname(false);
    }
  };

  // ── Change password ───────────────────────────────────────────
  const openPwModal = (u) => { setPwTarget(u); setNewPw(''); setConfirmPw(''); setShowPw(false); setPwOpen(true); };
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('Passwords do not match.'); return; }
    setSavingPw(true);
    try {
      await adminChangePassword(pwTarget.id, newPw);
      toast.success(`Password for "${pwTarget.username}" updated. User must log in again.`);
      setPwOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────
  const handleToggle = async () => {
    const u = toggleConfirm.user;
    setToggleConfirm({ open: false, user: null });
    try {
      await toggleUserActive(u.id);
      toast.success(`User "${u.username}" ${u.is_active ? 'deactivated' : 'activated'}.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const admins   = users.filter((u) => u.role === 'admin');
  const cashiers = users.filter((u) => u.role === 'cashier');

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage admin and cashier accounts"
        actions={
          <button className="btn btn-primary" onClick={() => { setCreateForm(EMPTY_CREATE); setCreateOpen(true); }}>
            + Add User
          </button>
        }
      />
      <div className="page" style={{ maxWidth: 860 }}>
        {loading ? <Spinner /> : (
          <>
            {/* Admins */}
            <div className="card mb-3">
              <div className="card-title" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 10px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 700 }}>ADMIN</span>
                Administrators
              </div>
              <UserTable users={admins} me={me} onUsername={openUnameModal} onPassword={openPwModal} onToggle={(u) => setToggleConfirm({ open: true, user: u })} />
            </div>

            {/* Cashiers */}
            <div className="card">
              <div className="card-title" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--success-light)', color: '#065f46', padding: '2px 10px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 700 }}>CASHIER</span>
                Cashier Accounts
              </div>
              <UserTable users={cashiers} me={me} onUsername={openUnameModal} onPassword={openPwModal} onToggle={(u) => setToggleConfirm({ open: true, user: u })} />
            </div>
          </>
        )}
      </div>

      {/* ── Create user modal ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add New User"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="create-user-form" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreate}>
          <div className="form-group mb-2">
            <label className="form-label">Role *</label>
            <select className="form-select" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group mb-2">
            <label className="form-label">Username *</label>
            <input
              className="form-input" autoFocus
              placeholder="Letters and numbers only"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              required minLength={3} maxLength={50}
            />
            <span className="form-hint">Min 3 characters, alphanumeric only.</span>
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password" className="form-input"
                placeholder="Min 8 characters"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required minLength={8}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input
                type="password" className="form-input"
                placeholder="Repeat password"
                value={createForm.confirmPassword}
                onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                required
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Change username modal ── */}
      <Modal
        open={unameOpen}
        onClose={() => setUnameOpen(false)}
        title={`Change Username — ${unameTarget?.username}`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setUnameOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="uname-form" type="submit" disabled={savingUname}>
              {savingUname ? 'Saving…' : 'Update Username'}
            </button>
          </>
        }
      >
        <form id="uname-form" onSubmit={handleChangeUsername}>
          <div className="form-group">
            <label className="form-label">New Username *</label>
            <input
              className="form-input" autoFocus
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required minLength={3} maxLength={50}
            />
            <span className="form-hint">User will be logged out and must sign in with the new username.</span>
          </div>
        </form>
      </Modal>

      {/* ── Change password modal ── */}
      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={`Reset Password — ${pwTarget?.username}`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPwOpen(false)}>Cancel</button>
            <button className="btn btn-primary" form="pw-form" type="submit" disabled={savingPw}>
              {savingPw ? 'Saving…' : 'Update Password'}
            </button>
          </>
        }
      >
        <form id="pw-form" onSubmit={handleChangePassword}>
          <div className="form-group mb-2">
            <label className="form-label">New Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="form-input" autoFocus
                placeholder="Min 8 characters"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required minLength={8}
                style={{ paddingRight: '2.8rem' }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <input
              type={showPw ? 'text' : 'password'}
              className="form-input"
              placeholder="Repeat password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
            />
            <span className="form-hint">User will be logged out automatically.</span>
          </div>
        </form>
      </Modal>

      {/* ── Toggle active confirm ── */}
      <ConfirmDialog
        open={toggleConfirm.open}
        onClose={() => setToggleConfirm({ open: false, user: null })}
        onConfirm={handleToggle}
        title={toggleConfirm.user?.is_active ? 'Deactivate User' : 'Activate User'}
        message={
          toggleConfirm.user?.is_active
            ? `Deactivate "${toggleConfirm.user?.username}"? They will not be able to log in.`
            : `Activate "${toggleConfirm.user?.username}"?`
        }
        danger={toggleConfirm.user?.is_active}
        confirmLabel={toggleConfirm.user?.is_active ? 'Deactivate' : 'Activate'}
      />
    </div>
  );
}

function UserTable({ users, me, onUsername, onPassword, onToggle }) {
  if (users.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '0.5rem 0' }}>No users in this group.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: u.role === 'admin' ? 'var(--primary-light)' : 'var(--success-light)',
                    color: u.role === 'admin' ? 'var(--primary)' : '#065f46',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                  }}>
                    {u.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{u.username}</strong>
                    {u.id === me?.id && (
                      <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#f1f5f9', color: '#64748b', padding: '1px 7px', borderRadius: 99 }}>you</span>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <span className={`badge ${u.is_active ? 'badge-success' : 'badge-gray'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => onUsername(u)}>
                    Change Username
                  </button>
                  <button className="btn btn-surface btn-sm" onClick={() => onPassword(u)}>
                    Reset Password
                  </button>
                  {u.id !== me?.id && (
                    <button
                      className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-success'}`}
                      onClick={() => onToggle(u)}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
