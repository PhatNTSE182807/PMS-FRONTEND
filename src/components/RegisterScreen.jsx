import { useState } from 'react';
import { ArrowRight, IdCard, Lock, Mail, Phone, RotateCcwKey, User } from 'lucide-react';
import AuthShowcaseLayout from './AuthShowcaseLayout';
import { AuthAlert, AuthCheckbox, AuthField } from './AuthFields';
import GoogleSignInButton from './GoogleSignInButton';
import { getErrorMessage } from '../api/apiError';
import { useRegister } from '../hooks/useAuth';
import { GOOGLE_CLIENT_ID } from '../lib/google-identity';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '../lib/password';
import { t, tMaybe } from '@/i18n'

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

export default function RegisterScreen({ onNavigateToLogin, onRegisterSuccess }) {
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

  return (
    <AuthShowcaseLayout
      wide
      title={t('Create your account')}
      subtitle={t('Register to manage vehicle passes and parking sessions in real time.')}
      photo="/register-car.jpg"
    >
      {errorMsg && <AuthAlert tone="error">{tMaybe(errorMsg)}</AuthAlert>}
      {successMsg && <AuthAlert tone="success">{tMaybe(successMsg)}</AuthAlert>}

      {/* One click instead of the form: the first Google sign-in creates the account */}
      <GoogleSignInButton text={t('signup_with')} />
      {GOOGLE_CLIENT_ID && <div className="auth-shell__divider">{t('Or')}</div>}

      <form className="auth-shell__form" onSubmit={handleRegister} noValidate>
        <div className="auth-shell__row">
          <AuthField
            id="reg-fullname"
            label={t('Full name')}
            icon={User}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
          <AuthField
            id="reg-phone"
            label={t('Phone number')}
            icon={Phone}
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            autoComplete="tel"
          />
        </div>

        <AuthField
          id="reg-email"
          label={t('Email address')}
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <AuthField
          id="reg-citizen-id"
          label={t('Citizen ID')}
          icon={IdCard}
          type="text"
          inputMode="numeric"
          maxLength={12}
          value={citizenId}
          onChange={(e) => setCitizenId(e.target.value.replace(/\D/g, ''))}
          autoComplete="off"
        />

        <div className="auth-shell__row">
          <div className="auth-shell__field">
            <AuthField
              id="reg-password"
              label={t('Password')}
              icon={Lock}
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
            label={t('Confirm password')}
            icon={RotateCcwKey}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            visible={showConfirmPassword}
            onToggleVisible={() => setShowConfirmPassword(!showConfirmPassword)}
          />
        </div>

        <AuthCheckbox checked={agreeTerms} onChange={setAgreeTerms}>
          {t('I agree to the')}
          {/* New tab: the form keeps what was typed */}
          <a href="/terms" target="_blank" rel="noopener" className="auth-shell__link auth-shell__link--muted">
            {t('Terms of Service')}
          </a>{t('and')}
          <a href="/privacy" target="_blank" rel="noopener" className="auth-shell__link auth-shell__link--muted">
            {t('Privacy Policy')}
          </a>
          .
        </AuthCheckbox>

        <button type="submit" className="auth-shell__submit" disabled={isLoading}>
          {isLoading ? t('Creating account...') : t('Create Account')}
          {!isLoading && <ArrowRight size={20} aria-hidden="true" />}
        </button>
      </form>

      <p className="auth-shell__footer">
        {t('Already have an account?')}
        <button type="button" className="auth-shell__link auth-shell__link--underline" onClick={onNavigateToLogin}>
          {t('Sign in')}
        </button>
      </p>
    </AuthShowcaseLayout>
  );
}
