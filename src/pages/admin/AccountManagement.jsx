import { useState, useEffect, useCallback } from 'react';
import { authService } from '../../services/authService';
import { userService, CREATABLE_ROLES_BY_ACTOR } from '../../services/userService';
import UserTable from './components/UserTable';
import CreateUserModal from './components/CreateUserModal';
import './AccountManagement.css';

/**
 * Account management (F1.3) for Web Admin.
 * Visible to Admin and Manager. The role options in the "Add staff" form depend on
 * the logged-in user's role (FR-AUTH-07); the Backend still enforces this.
 *
 * @param {{ currentUserRole?: string }} props - falls back to the role stored in the session.
 */
export default function AccountManagement({ currentUserRole }) {
  const role = currentUserRole ?? authService.getCurrentUser()?.role;
  const allowedRoles = CREATABLE_ROLES_BY_ACTOR[role] ?? [];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const res = await userService.getUsers();
    if (res.success) setUsers(res.data);
    else setLoadError(res.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (allowedRoles.length > 0) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUsers]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setFormError('');
  }, []);

  const handleCreate = async (form) => {
    setSubmitting(true);
    setFormError('');
    const res = await userService.createUser(form);
    setSubmitting(false);

    if (!res.success) {
      setFormError(res.message);
      return;
    }
    // createUser is a mock and does not persist, so add the result locally.
    setUsers((prev) => [res.data, ...prev]);
    setNotice(res.message);
    closeModal();
  };

  // Staff / User / Guest have no access to account management.
  if (allowedRoles.length === 0) {
    return (
      <section className="acc-page">
        <h1 className="acc-title">Account Management</h1>
        <div className="acc-state" role="alert">You do not have permission to manage accounts.</div>
      </section>
    );
  }

  return (
    <section className="acc-page">
      <header className="acc-header">
        <div>
          <h1 className="acc-title">Account Management</h1>
          <p className="acc-subtitle">
            {role === 'Admin' ? 'Create Manager and Staff accounts.' : 'Create Staff accounts for your parking lot.'}
          </p>
        </div>
        <button type="button" id="btn-add-staff" className="btn btn-primary-cyan" onClick={() => setModalOpen(true)}>
          + Add staff member
        </button>
      </header>

      {notice && (
        <div className="auth-alert auth-alert--success" role="status">
          <span>{notice}</span>
          <button type="button" className="acc-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">✕</button>
        </div>
      )}

      {loadError && (
        <div className="auth-alert auth-alert--error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn btn-outline-cyan btn-sm" onClick={loadUsers}>Retry</button>
        </div>
      )}

      <UserTable users={users} loading={loading} />

      {modalOpen && (
        <CreateUserModal
          allowedRoles={allowedRoles}
          submitting={submitting}
          serverError={formError}
          onSubmit={handleCreate}
          onClose={closeModal}
        />
      )}
    </section>
  );
}
