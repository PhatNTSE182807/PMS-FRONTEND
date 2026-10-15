import { useState } from 'react';
import AuthSplitLayout from './AuthSplitLayout';
import { getErrorMessage } from '../api/apiError';
import { useRegister } from '../hooks/useAuth';

export default function RegisterScreen({ onNavigateToLogin, onRegisterSuccess }) {
  const registerMutation = useRegister();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = registerMutation.isPending;
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Compute password strength (0 to 100%)
  const calculateStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 25;
    if (pwd.length >= 10) score += 25;
    if (/[A-Z]/.test(pwd)) score += 20;
    if (/[0-9]/.test(pwd)) score += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 15;
    return Math.min(score, 100);
  };

  const strength = calculateStrength(password);

  const handleRegister = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validations based on backend PMS.Application.Models.Validators
    if (!fullName.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMsg('Phone Number is required.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setErrorMsg('You must agree to the Terms of Service & Privacy Policy.');
      return;
    }

    // Derive username from email prefix or sanitized name (backend allows 5-20 characters)
    const userName = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user_' + Date.now().toString().slice(-4);

    registerMutation.mutate(
      {
        userName: userName.length < 5 ? `${userName}123` : userName,
        fullName: fullName.trim(),
        email: email.trim(),
        password: password,
        phoneNumber: phoneNumber.trim(),
      },
      {
        onSuccess: () => {
          setSuccessMsg('Account created successfully! Redirecting to login...');
          setTimeout(() => {
            if (onRegisterSuccess) {
              onRegisterSuccess({ email, fullName });
            } else {
              onNavigateToLogin();
            }
          }, 1500);
        },
        onError: (error) => setErrorMsg(getErrorMessage(error, 'Registration failed.')),
      },
    );
  };

  // Auto-fill demo info
  const fillSampleData = () => {
    setFullName('Alexander Vance');
    setEmail('alex.vance@xxivparking.vn');
    setPhoneNumber('0988123456');
    setPassword('Xxiv@2026');
    setConfirmPassword('Xxiv@2026');
    setAgreeTerms(true);
    setErrorMsg('');
  };

  return (
    <>
      <AuthSplitLayout title="Create your account" subtitle="Register to start booking parking slots.">
        <div className="glass-card register-glass-card">
          {errorMsg && (
            <div className="auth-alert auth-alert--error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert auth-alert--success" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="form-group">
              <input
                id="reg-fullname"
                type="text"
                className="cyber-input"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <input
                id="reg-email"
                type="email"
                className="cyber-input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <input
                id="reg-phone"
                type="tel"
                className="cyber-input"
                placeholder="Phone Number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoComplete="tel"
              />
            </div>

            <div className="form-group form-group--relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="cyber-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="eye-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>

              {/* Password Strength Indicator Bar */}
              <div className="password-strength-track">
                <div
                  className="password-strength-fill"
                  style={{ width: `${strength}%` }}
                ></div>
              </div>
            </div>

            <div className="form-group">
              <input
                id="reg-confirm-password"
                type={showPassword ? 'text' : 'password'}
                className="cyber-input"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {/* Terms of Service Checkbox */}
            <div className="auth-form-row">
              <label className="cyber-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="cyber-checkbox"
                />
                <span>
                  I agree to{' '}
                  <button
                    type="button"
                    className="auth-link-terms"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsTermsOpen(true);
                    }}
                  >
                    Terms of Service
                  </button>{' '}
                  &{' '}
                  <button
                    type="button"
                    className="auth-link-terms"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsTermsOpen(true);
                    }}
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary-cyan btn-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>

            <button
              type="button"
              className="demo-helper-btn demo-helper-btn--small"
              onClick={fillSampleData}
            >
              Fill Sample Data
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="auth-card-footer">
            <span>Already have an account? </span>
            <button
              type="button"
              className="auth-link-highlight"
              onClick={onNavigateToLogin}
            >
              Login Here
            </button>
          </div>
        </div>
      </AuthSplitLayout>

      {/* Terms & Privacy Modal */}
      {isTermsOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsTermsOpen(false)}>
          <div className="api-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>Terms of Service & Privacy Policy</h3>
              <button type="button" className="api-modal__close" onClick={() => setIsTermsOpen(false)}>✕</button>
            </div>
            <div className="api-modal__body" style={{ color: '#6F6A64', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <p>Welcome to <strong>XXIV Parking</strong>.</p>
              <p style={{ marginTop: '0.5rem' }}>
                1. <strong>Parking Access:</strong> Real-time reservation guarantees a reserved parking slot for your vehicle for up to 30 minutes after scheduled arrival.
              </p>
              <p style={{ marginTop: '0.5rem' }}>
                2. <strong>Automated Billing:</strong> Rates are calculated dynamically per parking zone and level. QR check-in & check-out logs timestamps automatically.
              </p>
              <p style={{ marginTop: '0.5rem' }}>
                3. <strong>Data Privacy:</strong> Your license plate and payment credentials are encrypted using industry-standard TLS encryption.
              </p>
            </div>
            <div className="api-modal__footer">
              <button
                type="button"
                className="btn btn-primary-cyan"
                onClick={() => {
                  setAgreeTerms(true);
                  setIsTermsOpen(false);
                }}
              >
                I Understand & Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
