import { useState } from 'react';
import { ArrowRight, IdCard, Lock, Mail, Phone, RotateCcwKey, User, X } from 'lucide-react';
import AuthShowcaseLayout from './AuthShowcaseLayout';
import { AuthAlert, AuthCheckbox, AuthField } from './AuthFields';
import GoogleSignInButton from './GoogleSignInButton';
import { getErrorMessage } from '../api/apiError';
import { useRegister } from '../hooks/useAuth';
import { GOOGLE_CLIENT_ID } from '../lib/google-identity';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '../lib/password';

// 0 = empty, 1 = weak ... 4 = strong; one point per rule met
function passwordScore(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.max(score, 1);
}

export default function RegisterScreen({ onNavigateToLogin, onRegisterSuccess, onLoginSuccess }) {
  const registerMutation = useRegister();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isLoading = registerMutation.isPending;
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isTermsOpen, setIsTermsOpen] = useState(false);

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
    if (!/^\d{12}$/.test(citizenId.trim())) {
      setErrorMsg('Citizen ID must have exactly 12 digits.');
      return;
    }
    if (!isValidPassword(password)) {
      setErrorMsg(PASSWORD_RULE_MESSAGE);
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

    // Derive username from email prefix or sanitized name (max 20 characters)
    const userName = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user_' + Date.now().toString().slice(-4);

    registerMutation.mutate(
      {
        userName: userName,
        fullName: fullName.trim(),
        email: email.trim(),
        password: password,
        phoneNumber: phoneNumber.trim(),
        citizenId: citizenId.trim(),
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

  const openTerms = (e) => {
    e.preventDefault();
    setIsTermsOpen(true);
  };

  return (
    <AuthShowcaseLayout
      wide
      title="Create your account"
      subtitle="Register to manage vehicle passes and parking sessions in real time."
      photo="/register-car.jpg"
      tagline="Smart parking management crafted for luxury vehicles. Join our automated mobility ecosystem."
    >
      {errorMsg && <AuthAlert tone="error">{errorMsg}</AuthAlert>}
      {successMsg && <AuthAlert tone="success">{successMsg}</AuthAlert>}

      {/* One click instead of the form: the first Google sign-in creates the account */}
      <GoogleSignInButton
        text="signup_with"
        variant="dark"
        onLoginSuccess={onLoginSuccess}
        onError={(message) => {
          setSuccessMsg('');
          setErrorMsg(message);
        }}
      />
      {GOOGLE_CLIENT_ID && <div className="auth-shell__divider">Or</div>}

      <form className="auth-shell__form" onSubmit={handleRegister} noValidate>
        <div className="auth-shell__row">
          <AuthField
            id="reg-fullname"
            label="Full name"
            icon={User}
            type="text"
            placeholder="Alexander Vance"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
          <AuthField
            id="reg-phone"
            label="Phone number"
            icon={Phone}
            type="tel"
            placeholder="0988 123 456"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            autoComplete="tel"
          />
        </div>

        <AuthField
          id="reg-email"
          label="Email address"
          icon={Mail}
          type="email"
          placeholder="name@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <AuthField
          id="reg-citizen-id"
          label="Citizen ID"
          icon={IdCard}
          type="text"
          inputMode="numeric"
          maxLength={12}
          placeholder="12-digit Citizen ID (CCCD)"
          value={citizenId}
          onChange={(e) => setCitizenId(e.target.value.replace(/\D/g, ''))}
          autoComplete="off"
        />

        <div className="auth-shell__row">
          <div className="auth-shell__field">
            <AuthField
              id="reg-password"
              label="Password"
              icon={Lock}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              visible={showPassword}
              onToggleVisible={() => setShowPassword(!showPassword)}
            />
            <div className="auth-shell__strength" data-score={passwordScore(password)} aria-hidden="true">
              <span /><span /><span /><span />
            </div>
          </div>
          <AuthField
            id="reg-confirm-password"
            label="Confirm password"
            icon={RotateCcwKey}
            placeholder="••••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            visible={showConfirmPassword}
            onToggleVisible={() => setShowConfirmPassword(!showConfirmPassword)}
          />
        </div>

        <AuthCheckbox checked={agreeTerms} onChange={setAgreeTerms}>
          I agree to the{' '}
          <button type="button" className="auth-shell__link auth-shell__link--muted" onClick={openTerms}>
            Terms of Service
          </button>{' '}
          and{' '}
          <button type="button" className="auth-shell__link auth-shell__link--muted" onClick={openTerms}>
            Privacy Policy
          </button>
          .
        </AuthCheckbox>

        <button type="submit" className="auth-shell__submit" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create Account'}
          {!isLoading && <ArrowRight size={20} aria-hidden="true" />}
        </button>
      </form>

      <p className="auth-shell__footer">
        Already have an account?
        <button type="button" className="auth-shell__link auth-shell__link--underline" onClick={onNavigateToLogin}>
          Sign in
        </button>
      </p>


      {isTermsOpen && (
        <div className="auth-shell__backdrop" onClick={() => setIsTermsOpen(false)}>
          <div className="auth-shell__dialog" role="dialog" aria-modal="true" aria-labelledby="terms-title" onClick={(e) => e.stopPropagation()}>
            <div className="auth-shell__dialog-header">
              <h2 id="terms-title" className="auth-shell__dialog-title">Terms of Service &amp; Privacy Policy</h2>
              <button type="button" className="auth-shell__toggle" onClick={() => setIsTermsOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="auth-shell__dialog-body">
              <p>Welcome to <strong>XXIV Parking</strong>.</p>
              <p>
                1. <strong>Parking Access:</strong> Real-time reservation guarantees a reserved parking slot for your vehicle for up to 30 minutes after scheduled arrival.
              </p>
              <p>
                2. <strong>Automated Billing:</strong> Rates are calculated dynamically per parking zone and level. QR check-in &amp; check-out logs timestamps automatically.
              </p>
              <p>
                3. <strong>Data Privacy:</strong> Your license plate and payment credentials are encrypted using industry-standard TLS encryption.
              </p>
            </div>
            <div className="auth-shell__dialog-footer">
              <button
                type="button"
                className="auth-shell__submit"
                onClick={() => {
                  setAgreeTerms(true);
                  setIsTermsOpen(false);
                }}
              >
                I understand &amp; agree
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthShowcaseLayout>
  );
}
