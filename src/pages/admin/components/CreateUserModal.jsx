import { useState, useEffect } from 'react';

const EMPTY_FORM = {
  userName: '',
  fullName: '',
  email: '',
  phoneNumber: '',
  role: '',
  assignedParkingLot: '',
};

// Same rules as API_DOCUMENT 3.1.1 (VN phone: 10 digits, 03/05/07/08/09, or +84 prefix).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+84|0)(3|5|7|8|9)\d{8}$/;

const validate = (f, allowedRoles) => {
  const errors = {};
  if (f.userName.trim().length < 3 || f.userName.trim().length > 50) {
    errors.userName = 'Username must be 3-50 characters.';
  }
  if (!f.fullName.trim()) errors.fullName = 'Full name is required.';
  else if (f.fullName.length > 200) errors.fullName = 'Max 200 characters.';
  if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Invalid email.';
  if (!PHONE_RE.test(f.phoneNumber.trim())) errors.phoneNumber = 'Invalid Vietnamese phone number.';
  if (!allowedRoles.includes(f.role)) errors.role = 'You cannot assign this role.';
  if (!f.assignedParkingLot.trim()) errors.assignedParkingLot = 'Parking lot is required.';
  return errors;
};

/**
 * Modal form to create an internal account.
 * Role options come from `allowedRoles` (derived from the logged-in user's role),
 * so a Manager only sees "Staff" and an Admin sees "Manager" and "Staff" (FR-AUTH-07).
 *
 * @param {{
 *   allowedRoles: string[],
 *   submitting: boolean,
 *   serverError?: string,
 *   onSubmit: (form: typeof EMPTY_FORM) => void,
 *   onClose: () => void
 * }} props
 */
export default function CreateUserModal({ allowedRoles, submitting, serverError = '', onSubmit, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, role: allowedRoles[0] ?? '' });
  const [errors, setErrors] = useState({});

  // Close on Escape (unless a request is in flight).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [submitting, onClose]);

  const setField = (name) => (e) => {
    setForm((prev) => ({ ...prev, [name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = validate(form, allowedRoles);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(form);
  };

  const renderField = (name, label, props = {}) => (
    <div className="form-group acc-field">
      <label htmlFor={`cu-${name}`} className="acc-label">{label}</label>
      <input
        id={`cu-${name}`}
        className="cyber-input"
        value={form[name]}
        onChange={setField(name)}
        disabled={submitting}
        {...props}
      />
      {errors[name] && <span className="acc-error">{errors[name]}</span>}
    </div>
  );

  return (
    <div
      className="acc-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="acc-modal" role="dialog" aria-modal="true" aria-labelledby="cu-title">
        <h2 id="cu-title" className="acc-modal__title">Add staff member</h2>

        {serverError && <div className="auth-alert auth-alert--error" role="alert"><span>{serverError}</span></div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="acc-grid">
            {renderField('userName', 'Username', { autoComplete: 'off' })}
            {renderField('fullName', 'Full name')}
            {renderField('email', 'Email', { type: 'email' })}
            {renderField('phoneNumber', 'Phone number', { type: 'tel', placeholder: '0912345678' })}

            <div className="form-group acc-field">
              <label htmlFor="cu-role" className="acc-label">Role</label>
              <select
                id="cu-role"
                className="cyber-input"
                value={form.role}
                onChange={setField('role')}
                disabled={submitting || allowedRoles.length === 1}
              >
                {allowedRoles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.role && <span className="acc-error">{errors.role}</span>}
            </div>

            {renderField('assignedParkingLot', 'Assigned parking lot', { placeholder: 'e.g. Lot A - District 1' })}
          </div>

          <p className="acc-hint">An activation link will be sent; the user must change password and enable 2FA on first login.</p>

          <div className="acc-actions">
            <button type="button" className="btn btn-outline-cyan" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary-cyan" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
