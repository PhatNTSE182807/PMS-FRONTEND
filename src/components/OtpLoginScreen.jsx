import { useEffect, useRef, useState } from 'react';
import AuthSplitLayout from './AuthSplitLayout';
import { getErrorMessage } from '../api/apiError';
import { useOtpLogin, useRequestLoginOtp } from '../hooks/useAuth';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OtpLoginScreen({ onLoginSuccess, onNavigateToLogin }) {
  const requestCodeMutation = useRequestLoginOtp();
  const otpLoginMutation = useOtpLogin();

  // 'email' -> enter address, 'code' -> enter the 6 digits from the inbox
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [rememberMe, setRememberMe] = useState(false);

  const isLoading = requestCodeMutation.isPending || otpLoginMutation.isPending;
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const digitRefs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') digitRefs.current[0]?.focus();
  }, [step]);

  const sendCode = async () => {
    setErrorMsg('');
    setInfoMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your email!');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setErrorMsg('Please enter a valid email address!');
      return;
    }

    let message;
    try {
      message = await requestCodeMutation.mutateAsync({ email: email.trim() });
    } catch (error) {
      setErrorMsg(getErrorMessage(error, 'Could not send the login code.'));
      return;
    }

    setDigits(Array(CODE_LENGTH).fill(''));
    setInfoMsg(message || 'If the email is registered, a login code has been sent to it.');
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep('code');
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    sendCode();
  };

  const verifyCode = async (code) => {
    setErrorMsg('');
    try {
      const user = await otpLoginMutation.mutateAsync({ email: email.trim(), code, rememberMe });
      onLoginSuccess(user);
      return;
    } catch (error) {
      setInfoMsg('');
      setErrorMsg(getErrorMessage(error, 'Login code is invalid or has expired.'));
    }
    setDigits(Array(CODE_LENGTH).fill(''));
    digitRefs.current[0]?.focus();
  };

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      setErrorMsg(`Please enter all ${CODE_LENGTH} digits of the code!`);
      return;
    }
    verifyCode(code);
  };

  const fillDigits = (startIndex, value) => {
    const incoming = value.replace(/\D/g, '').slice(0, CODE_LENGTH - startIndex);
    if (!incoming) return;

    const next = [...digits];
    incoming.split('').forEach((d, i) => {
      next[startIndex + i] = d;
    });
    setDigits(next);

    const nextIndex = Math.min(startIndex + incoming.length, CODE_LENGTH - 1);
    digitRefs.current[nextIndex]?.focus();

    // Submit as soon as the last box is filled (typing or pasting)
    if (next.every(Boolean) && !isLoading) verifyCode(next.join(''));
  };

  const handleDigitChange = (index, value) => {
    if (value === '') {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    fillDigits(index, value);
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index, e) => {
    e.preventDefault();
    fillDigits(index, e.clipboardData.getData('text'));
  };

  const changeEmail = () => {
    setStep('email');
    setErrorMsg('');
    setInfoMsg('');
  };

  return (
    <>
      <AuthSplitLayout>
        <div className="glass-card login-glass-card">
          <div className="otp-heading">
            <span className="otp-heading__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </svg>
            </span>
            <h2 className="otp-heading__title">
              {step === 'email' ? 'Sign in with email code' : 'Check your inbox'}
            </h2>
            <p className="otp-heading__subtitle">
              {step === 'email' ? (
                'We will email you a 6-digit code. No password needed.'
              ) : (
                <>
                  Enter the code sent to <strong>{email.trim()}</strong>
                </>
              )}
            </p>
          </div>

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

          {infoMsg && (
            <div className="auth-alert auth-alert--info" role="status">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>{infoMsg}</span>
            </div>
          )}

          {step === 'email' ? (
            <form className="auth-form" onSubmit={handleEmailSubmit} noValidate>
              <div className="form-group">
                <input
                  id="otp-email"
                  type="email"
                  className="cyber-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button type="submit" className="btn btn-primary-cyan btn-full" disabled={isLoading}>
                {isLoading ? 'Sending code...' : 'Send login code'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleCodeSubmit} noValidate>
              <div className="otp-code-inputs" role="group" aria-label="6-digit login code">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      digitRefs.current[index] = el;
                    }}
                    className={`otp-digit ${digit ? 'otp-digit--filled' : ''}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={CODE_LENGTH}
                    value={digit}
                    aria-label={`Digit ${index + 1}`}
                    // readOnly instead of disabled so focus can move back to the first box after a failed attempt
                    readOnly={isLoading}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    onPaste={(e) => handlePaste(index, e)}
                    onFocus={(e) => e.target.select()}
                  />
                ))}
              </div>

              <div className="auth-form-row">
                <label className="cyber-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="cyber-checkbox"
                  />
                  <span>Remember Me</span>
                </label>

                <button type="button" className="auth-link-btn" onClick={changeEmail}>
                  Change email
                </button>
              </div>

              <button type="submit" className="btn btn-primary-cyan btn-full" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify & Login'}
              </button>

              <div className="otp-resend">
                {cooldown > 0 ? (
                  <span>
                    Resend code in <strong>{cooldown}s</strong>
                  </span>
                ) : (
                  <>
                    <span>Didn&apos;t get the email? </span>
                    <button type="button" className="auth-link-btn" onClick={sendCode} disabled={isLoading}>
                      Resend code
                    </button>
                  </>
                )}
              </div>
            </form>
          )}

          <div className="sso-section">
            <div className="sso-divider">
              <span>or</span>
            </div>
          </div>

          <div className="auth-card-footer auth-card-footer--tight">
            <span>Prefer your password? </span>
            <button type="button" className="auth-link-highlight" onClick={onNavigateToLogin}>
              Back to Login
            </button>
          </div>
        </div>
      </AuthSplitLayout>
    </>
  );
}
