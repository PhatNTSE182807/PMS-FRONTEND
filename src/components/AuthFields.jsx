import { Check, CircleAlert, CircleCheck, Eye, EyeOff, Info } from 'lucide-react';

const ALERT_ICONS = { error: CircleAlert, info: Info, success: CircleCheck };

/** Status line above the Login/Register forms. */
export function AuthAlert({ tone, children }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`auth-shell__alert auth-shell__alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Labelled input with a leading icon. Password fields get a show/hide toggle when
 * `onToggleVisible` is passed.
 */
export function AuthField({ id, label, icon, labelAside, visible, onToggleVisible, ...inputProps }) {
  const Icon = icon;
  const hasToggle = Boolean(onToggleVisible);
  return (
    <div className="auth-shell__field">
      <div className="auth-shell__label-row">
        <label className="auth-shell__label" htmlFor={id}>{label}</label>
        {labelAside}
      </div>
      <div className="auth-shell__control">
        <span className="auth-shell__control-icon" aria-hidden="true">
          <Icon size={19} strokeWidth={1.75} />
        </span>
        <input
          id={id}
          className={`auth-shell__input ${hasToggle ? 'auth-shell__input--with-toggle' : ''}`}
          {...inputProps}
          type={hasToggle ? (visible ? 'text' : 'password') : inputProps.type}
        />
        {hasToggle && (
          <button
            type="button"
            className="auth-shell__toggle"
            onClick={onToggleVisible}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function AuthCheckbox({ checked, onChange, children }) {
  return (
    <label className="auth-shell__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="auth-shell__check-box" aria-hidden="true">
        <Check size={12} strokeWidth={3.5} />
      </span>
      <span>{children}</span>
    </label>
  );
}
