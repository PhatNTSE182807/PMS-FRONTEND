import { useState, useEffect } from 'react';
import { ZONE_TYPES } from '../../../services/parkingService';

const validate = (f) => {
  const errors = {};
  if (!f.name.trim()) errors.name = 'Zone name is required.';
  else if (f.name.trim().length > 100) errors.name = 'Max 100 characters.';
  if (!ZONE_TYPES.includes(f.type)) errors.type = 'Select a zone type.';
  return errors;
};

/**
 * Modal form to create a zone inside a parking lot (FR-LOT-02).
 *
 * @param {{
 *   lotName: string,
 *   submitting: boolean,
 *   serverError?: string,
 *   onSubmit: (form: { name: string, type: string }) => void,
 *   onClose: () => void
 * }} props
 */
export default function ZoneFormModal({ lotName, submitting, serverError = '', onSubmit, onClose }) {
  const [form, setForm] = useState({ name: '', type: ZONE_TYPES[0] });
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
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(form);
  };

  return (
    <div
      className="acc-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="acc-modal pm-modal--narrow" role="dialog" aria-modal="true" aria-labelledby="zn-title">
        <h2 id="zn-title" className="acc-modal__title">Add new zone</h2>
        <p className="acc-subtitle pm-modal__sub">Parking lot: <strong>{lotName}</strong></p>

        {serverError && <div className="auth-alert auth-alert--error" role="alert"><span>{serverError}</span></div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="acc-grid pm-grid--single">
            <div className="form-group acc-field">
              <label htmlFor="zn-name" className="acc-label">Zone name</label>
              <input
                id="zn-name"
                className="cyber-input"
                value={form.name}
                onChange={setField('name')}
                disabled={submitting}
                autoComplete="off"
                placeholder="e.g. Floor 2 - Row C"
                autoFocus
              />
              {errors.name && <span className="acc-error">{errors.name}</span>}
            </div>

            <div className="form-group acc-field">
              <label htmlFor="zn-type" className="acc-label">Vehicle type</label>
              <select
                id="zn-type"
                className="cyber-input"
                value={form.type}
                onChange={setField('type')}
                disabled={submitting}
              >
                {ZONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.type && <span className="acc-error">{errors.type}</span>}
            </div>
          </div>

          <div className="acc-actions">
            <button type="button" className="btn btn-outline-cyan" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" id="btn-submit-zone" className="btn btn-primary-cyan" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create zone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
