import { useState, useEffect } from 'react';

const EMPTY_FORM = {
  name: '',
  address: '',
  capacity: '',
  openTime: '06:00',
  closeTime: '22:00',
  isActive: true,
};

const validate = (f) => {
  const errors = {};
  if (!f.name.trim()) errors.name = 'Name is required.';
  else if (f.name.trim().length > 200) errors.name = 'Max 200 characters.';
  if (!f.address.trim()) errors.address = 'Address is required.';
  const capacity = Number(f.capacity);
  if (!Number.isInteger(capacity) || capacity <= 0) errors.capacity = 'Enter a positive whole number.';
  if (!f.openTime) errors.openTime = 'Required.';
  if (!f.closeTime) errors.closeTime = 'Required.';
  if (f.openTime && f.openTime === f.closeTime) errors.closeTime = 'Must differ from open time.';
  return errors;
};

/**
 * Modal form to create a parking lot (FR-LOT-01).
 *
 * @param {{
 *   submitting: boolean,
 *   serverError?: string,
 *   onSubmit: (form: typeof EMPTY_FORM) => void,
 *   onClose: () => void
 * }} props
 */
export default function ParkingLotFormModal({ submitting, serverError = '', onSubmit, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
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
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(form);
  };

  const renderField = (name, label, props = {}, full = false) => (
    <div className={`form-group acc-field${full ? ' acc-field--full' : ''}`}>
      <label htmlFor={`pl-${name}`} className="acc-label">{label}</label>
      <input
        id={`pl-${name}`}
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
      <div className="acc-modal" role="dialog" aria-modal="true" aria-labelledby="pl-title">
        <h2 id="pl-title" className="acc-modal__title">Add new parking lot</h2>

        {serverError && <div className="auth-alert auth-alert--error" role="alert"><span>{serverError}</span></div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="acc-grid">
            {renderField('name', 'Parking lot name', { autoComplete: 'off', placeholder: 'e.g. Lot D - District 7' }, true)}
            {renderField('address', 'Address', { placeholder: 'Street, ward, district, city' }, true)}
            {renderField('capacity', 'Capacity (slots)', { type: 'number', min: 1, step: 1, placeholder: '200' })}

            <div className="form-group acc-field pm-check">
              <span className="acc-label">Status</span>
              <label htmlFor="pl-isActive" className="pm-check__label">
                <input
                  id="pl-isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={setField('isActive')}
                  disabled={submitting}
                />
                Active (open for operation)
              </label>
            </div>

            {renderField('openTime', 'Open time', { type: 'time' })}
            {renderField('closeTime', 'Close time', { type: 'time' })}
          </div>

          <div className="acc-actions">
            <button type="button" className="btn btn-outline-cyan" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" id="btn-submit-lot" className="btn btn-primary-cyan" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create parking lot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
