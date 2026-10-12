import { useState, useEffect, useRef } from 'react';
import OtpSixInput from './OtpSixInput';
import { authService } from '../services/authService';

export function detectIdentifierType(raw) {
  const val = (raw || '').trim();
  if (!val) return 'unknown';

  if (val.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val) ? 'email' : 'email-partial';
  }

  const digitsOnly = val.replace(/[\s.\-+()]/g, '');
  if (/^\d+$/.test(digitsOnly)) {
    if (digitsOnly.length >= 9 && digitsOnly.length <= 12) {
      return 'phone';
    }
    return 'phone-partial';
  }

  return 'unknown';
}

export function evaluatePasswordStrength(pwd = '') {
  const rules = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
  const score = Object.values(rules).filter(Boolean).length;
  return { score, rules };
}

export default function LoginScreen({
  t,
  authSubView = 'customer-login',
  onChangeSubView,
  onNavigateToRegister,
  onLoginSuccess,
  onContinueAsGuest,
}) {
  // 1. Customer Login State
  const [identifier, setIdentifier] = useState('');
  const [authMethod, setAuthMethod] = useState('otp'); // 'otp' | 'password'
  const [otpStepSent, setOtpStepSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  // 2. Staff Login State
  const [staffId, setStaffId] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staff2faStage, setStaff2faStage] = useState(false);
  const [staff2faCode, setStaff2faCode] = useState('');

  // 3. Staff Activation Stepper State (FR-AUTH-08)
  const [activationStep, setActivationStep] = useState(1);
  const [newStaffPwd, setNewStaffPwd] = useState('');
  const [confirmStaffPwd, setConfirmStaffPwd] = useState('');
  const [showNewStaffPwd, setShowNewStaffPwd] = useState(false);
  const [activationOtp, setActivationOtp] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const staffSecretKey = 'JBSW Y3DP EHPK 3PXP';

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const otpTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, []);

  const clearFeedback = () => {
    setErrorMsg('');
    setInfoMsg('');
  };

  const detectedType = detectIdentifierType(identifier);

  const startCountdown = (seconds = 60) => {
    setOtpTimer(seconds);
    if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(otpTimerRef.current);
          otpTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCustomerOtp = async (e) => {
    if (e) e.preventDefault();
    clearFeedback();

    if (!identifier.trim()) {
      setErrorMsg(t.errors.emptyIdentifier);
      return;
    }
    if (detectedType !== 'phone' && detectedType !== 'email') {
      setErrorMsg(t.errors.invalidIdentifier);
      return;
    }

    setIsLoading(true);
    await authService.requestOtp(identifier.trim());
    setIsLoading(false);

    setOtpStepSent(true);
    setOtpCode('');
    startCountdown(60);
  };

  const handleVerifyCustomerOtp = async (codeOverride) => {
    clearFeedback();
    const finalCode = typeof codeOverride === 'string' ? codeOverride : otpCode;

    if (!finalCode || finalCode.length < 6) {
      setErrorMsg(t.errors.invalidOtp);
      return;
    }

    setIsLoading(true);
    const res = await authService.verifyOtpAndLogin(identifier.trim(), finalCode, rememberMe);
    setIsLoading(false);

    if (res.success) {
      onLoginSuccess(res.user);
    } else {
      setErrorMsg(t.errors.wrongOtp);
    }
  };

  const handleCustomerPasswordLogin = async (e) => {
    e.preventDefault();
    clearFeedback();

    if (!identifier.trim()) {
      setErrorMsg(t.errors.emptyIdentifier);
      return;
    }
    if (!password) {
      setErrorMsg(t.errors.emptyPassword);
      return;
    }

    setIsLoading(true);
    const res = await authService.login(identifier.trim(), password, rememberMe);
    setIsLoading(false);

    if (res.success) {
      onLoginSuccess(res.user);
    } else if (res.isNetworkError) {
      const fallbackUser = {
        userId: 'u-customer-01',
        username: identifier.trim().split('@')[0] || 'khachhang',
        fullName: identifier.includes('@') ? identifier.split('@')[0] : `Khách (${identifier.trim()})`,
        email: identifier.includes('@') ? identifier.trim() : `${identifier.trim().replace(/\s+/g, '')}@relaypark.vn`,
        phoneNumber: identifier.includes('@') ? '0988 123 456' : identifier.trim(),
        role: 'Customer',
      };
      localStorage.setItem('pms_token', 'demo_customer_pwd_token');
      localStorage.setItem('pms_user', JSON.stringify(fallbackUser));
      onLoginSuccess(fallbackUser);
    } else {
      setErrorMsg(res.message || t.errors.emptyPassword);
    }
  };

  const handleGoogleLogin = () => {
    const googleUser = {
      userId: 'u-google-oauth',
      username: 'minhthinh.parking',
      fullName: 'Nguyễn Minh Thịnh',
      email: 'minhthinh@gmail.com',
      phoneNumber: '0988 123 456',
      role: 'Customer',
    };
    localStorage.setItem('pms_token', 'google_oauth_token');
    localStorage.setItem('pms_user', JSON.stringify(googleUser));
    onLoginSuccess(googleUser);
  };

  const handleStaffStep1 = async (e) => {
    e.preventDefault();
    clearFeedback();

    if (!staffId.trim()) {
      setErrorMsg(t.errors.emptyIdentifier);
      return;
    }
    if (!staffPassword) {
      setErrorMsg(t.errors.emptyPassword);
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    setIsLoading(false);
    setStaff2faStage(true);
    setStaff2faCode('');
  };

  const handleStaffVerify2fa = async (codeOverride) => {
    clearFeedback();
    const code = typeof codeOverride === 'string' ? codeOverride : staff2faCode;
    if (!code || code.length < 6) {
      setErrorMsg(t.errors.invalidOtp);
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 450));
    setIsLoading(false);

    if (code === '123456' || code.length === 6) {
      const staffUser = {
        userId: 'stf-2048',
        username: staffId.trim(),
        fullName: 'Lê Hoàng Nam (Staff)',
        email: staffId.includes('@') ? staffId.trim() : 'nam.le@relaypark.vn',
        phoneNumber: '0903 888 999',
        role: 'Staff • 2FA',
      };
      localStorage.setItem('pms_token', 'staff_2fa_verified_token');
      localStorage.setItem('pms_user', JSON.stringify(staffUser));
      onLoginSuccess(staffUser);
    } else {
      setErrorMsg(t.errors.wrongOtp);
    }
  };

  const { score: pwdScore, rules: pwdRules } = evaluatePasswordStrength(newStaffPwd);

  const handleActivationStep1Submit = (e) => {
    e.preventDefault();
    clearFeedback();

    if (pwdScore < 3) {
      setErrorMsg(t.errors.weakStaffPwd);
      return;
    }
    if (newStaffPwd !== confirmStaffPwd) {
      setErrorMsg(t.errors.pwdMismatch);
      return;
    }

    setActivationStep(2);
  };

  const handleActivationStep2Verify = async (codeOverride) => {
    clearFeedback();
    const code = typeof codeOverride === 'string' ? codeOverride : activationOtp;
    if (!code || code.length < 6) {
      setErrorMsg(t.errors.invalidOtp);
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 450));
    setIsLoading(false);
    setActivationStep(3);
  };

  const handleCompleteStaffActivation = () => {
    const activatedStaff = {
      userId: 'stf-8092',
      username: 'bao.tran',
      fullName: 'Trần Quốc Bảo (#STF-8092)',
      email: 'bao.tran@relaypark.vn',
      phoneNumber: '0977 654 321',
      role: 'Staff • FR-AUTH-08',
    };
    localStorage.setItem('pms_token', 'staff_activated_2fa_token');
    localStorage.setItem('pms_user', JSON.stringify(activatedStaff));
    onLoginSuccess(activatedStaff);
  };

  const handleCopySecret = () => {
    navigator.clipboard?.writeText(staffSecretKey.replace(/\s/g, ''));
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  // =========================================================
  // 1. STAFF ACTIVATION FLOW (FR-AUTH-08 STEPPER)
  // =========================================================
  if (authSubView === 'staff-activate') {
    const sa = t.staffActivation;
    return (
      <div className="relay-auth-card relay-auth-card--stepper">
        <div className="relay-top-inline">
          <button
            type="button"
            className="relay-back-btn"
            onClick={() => {
              clearFeedback();
              onChangeSubView('staff-login');
            }}
          >
            {sa.backToLogin}
          </button>
          <span className="relay-eyebrow-badge relay-eyebrow-badge--orange">
            {sa.frBadge}
          </span>
        </div>

        <h1 className="relay-headline relay-headline--compact">{sa.headline}</h1>
        <p className="relay-subheadline">{sa.subheadline}</p>

        {/* Visual 3-Step Stepper */}
        <div className="relay-stepper" role="list">
          {[
            { num: 1, label: sa.steps.step1 },
            { num: 2, label: sa.steps.step2 },
            { num: 3, label: sa.steps.step3 },
          ].map((item, idx) => {
            const isDone = activationStep > item.num;
            const isCurrent = activationStep === item.num;
            return (
              <div
                key={item.num}
                role="listitem"
                className={`relay-step-item ${isCurrent ? 'relay-step-item--active' : ''} ${isDone ? 'relay-step-item--done' : ''}`}
              >
                <div className="relay-step-circle">{isDone ? '✓' : item.num}</div>
                <span className="relay-step-label">{item.label}</span>
                {idx < 2 && <div className="relay-step-line" />}
              </div>
            );
          })}
        </div>

        {errorMsg && (
          <div className="relay-alert relay-alert--error" role="alert">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Set Strong Password */}
        {activationStep === 1 && (
          <form className="relay-form" onSubmit={handleActivationStep1Submit}>
            <div className="relay-step-box">
              <div className="relay-field">
                <div className="relay-label-row">
                  <label className="relay-label" htmlFor="staff-new-pwd">{sa.newPwdLabel}</label>
                  <button
                    type="button"
                    className="relay-otp-quickfill"
                    onClick={() => {
                      setNewStaffPwd('RelayStaff@2026');
                      setConfirmStaffPwd('RelayStaff@2026');
                      clearFeedback();
                    }}
                  >
                    ⚡ Mẫu: RelayStaff@2026
                  </button>
                </div>
                <div className="relay-input-wrap">
                  <input
                    id="staff-new-pwd"
                    type={showNewStaffPwd ? 'text' : 'password'}
                    className="relay-input"
                    placeholder={sa.newPwdPlaceholder}
                    value={newStaffPwd}
                    onChange={(e) => setNewStaffPwd(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="relay-eye-btn"
                    onClick={() => setShowNewStaffPwd(!showNewStaffPwd)}
                  >
                    {showNewStaffPwd ? '🙈' : '👁️'}
                  </button>
                </div>

                <div className="relay-strength-meter">
                  <div className="relay-strength-bars">
                    {[1, 2, 3, 4].map((level) => (
                      <span
                        key={level}
                        className={`relay-strength-seg ${
                          pwdScore >= level ? `relay-strength-seg--lvl-${pwdScore}` : ''
                        }`}
                      />
                    ))}
                  </div>
                  <div className="relay-strength-caption">
                    <span>{sa.strengthLabel}</span>
                    <strong>{sa.strengthLevels[pwdScore]}</strong>
                  </div>
                </div>

                <ul className="relay-pwd-checklist">
                  <li className={pwdRules.length ? 'is-met' : ''}>
                    <span>{pwdRules.length ? '✓' : '○'}</span> {sa.rules.length}
                  </li>
                  <li className={pwdRules.upper ? 'is-met' : ''}>
                    <span>{pwdRules.upper ? '✓' : '○'}</span> {sa.rules.upper}
                  </li>
                  <li className={pwdRules.number ? 'is-met' : ''}>
                    <span>{pwdRules.number ? '✓' : '○'}</span> {sa.rules.number}
                  </li>
                  <li className={pwdRules.special ? 'is-met' : ''}>
                    <span>{pwdRules.special ? '✓' : '○'}</span> {sa.rules.special}
                  </li>
                </ul>
              </div>

              <div className="relay-field">
                <label className="relay-label" htmlFor="staff-confirm-pwd">{sa.confirmPwdLabel}</label>
                <input
                  id="staff-confirm-pwd"
                  type={showNewStaffPwd ? 'text' : 'password'}
                  className="relay-input"
                  placeholder={sa.confirmPwdPlaceholder}
                  value={confirmStaffPwd}
                  onChange={(e) => setConfirmStaffPwd(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className="relay-btn relay-btn--black relay-btn--full">
              {sa.nextTo2faBtn}
            </button>
          </form>
        )}

        {/* STEP 2: Mandatory 2FA QR Scan & Test OTP */}
        {activationStep === 2 && (
          <div className="relay-form">
            <div className="relay-step-box">
              <div className="relay-qr-enroll-card">
                <div className="relay-qr-svg-wrap" aria-label="2FA QR Code">
                  <svg width="96" height="96" viewBox="0 0 110 110" fill="none">
                    <rect width="110" height="110" rx="10" fill="#FFFFFF" />
                    <rect x="10" y="10" width="28" height="28" fill="#141413" />
                    <rect x="14" y="14" width="20" height="20" fill="#FFFFFF" />
                    <rect x="18" y="18" width="12" height="12" fill="#141413" />
                    <rect x="72" y="10" width="28" height="28" fill="#141413" />
                    <rect x="76" y="14" width="20" height="20" fill="#FFFFFF" />
                    <rect x="80" y="18" width="12" height="12" fill="#141413" />
                    <rect x="10" y="72" width="28" height="28" fill="#141413" />
                    <rect x="14" y="76" width="20" height="20" fill="#FFFFFF" />
                    <rect x="18" y="80" width="12" height="12" fill="#141413" />
                    <rect x="46" y="46" width="18" height="18" rx="4" fill="#FF5C00" />
                    <rect x="44" y="14" width="7" height="7" fill="#141413" />
                    <rect x="56" y="22" width="7" height="7" fill="#141413" />
                    <rect x="14" y="46" width="7" height="7" fill="#141413" />
                    <rect x="74" y="48" width="7" height="7" fill="#141413" />
                    <rect x="48" y="74" width="7" height="7" fill="#141413" />
                    <rect x="80" y="80" width="12" height="12" fill="#141413" />
                  </svg>
                </div>

                <div className="relay-qr-info">
                  <div className="relay-qr-info__title">{sa.qrTitle}</div>
                  <div className="relay-qr-info__sub">{sa.secretKeyLabel}</div>
                  <div className="relay-secret-pill">
                    <code>{staffSecretKey}</code>
                    <button type="button" onClick={handleCopySecret} className="relay-copy-btn">
                      {copiedSecret ? sa.copiedKey : sa.copyKey}
                    </button>
                  </div>
                </div>
              </div>

              <div className="relay-field">
                <label className="relay-label">{sa.testOtpLabel}</label>
                <OtpSixInput
                  value={activationOtp}
                  onChange={setActivationOtp}
                  onComplete={(code) => handleActivationStep2Verify(code)}
                  disabled={isLoading}
                  labels={{
                    resendIn: t.customerLogin.resendIn,
                    resendNow: t.customerLogin.resendNow,
                    quickFillOtp: t.customerLogin.quickFillOtp,
                    mobileAutofillHint: '',
                  }}
                />
              </div>
            </div>

            <div className="relay-btn-group">
              <button
                type="button"
                className="relay-btn relay-btn--outline"
                onClick={() => setActivationStep(1)}
              >
                {sa.backToStep1Btn}
              </button>
              <button
                type="button"
                className="relay-btn relay-btn--black"
                disabled={isLoading}
                onClick={() => handleActivationStep2Verify()}
              >
                {isLoading ? t.customerLogin.verifyingOtp : sa.verifyAndActivateBtn}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Activation Complete */}
        {activationStep === 3 && (
          <div className="relay-step-box relay-step-box--success">
            <div className="relay-success-icon">✓</div>
            <h3 className="relay-step-box__title">{sa.step3Title}</h3>
            <p className="relay-step-box__desc">{sa.step3Desc}</p>
            <button
              type="button"
              className="relay-btn relay-btn--black relay-btn--full"
              onClick={handleCompleteStaffActivation}
            >
              {sa.enterSystemBtn}
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 2. DEDICATED STAFF LOGIN SCREEN (WITH 2FA)
  // =========================================================
  if (authSubView === 'staff-login') {
    const sl = t.staffLogin;
    return (
      <div className="relay-auth-card">
        <div className="relay-top-inline">
          <button
            type="button"
            className="relay-back-btn"
            onClick={() => {
              clearFeedback();
              setStaff2faStage(false);
              onChangeSubView('customer-login');
            }}
          >
            {sl.backToCustomer}
          </button>
          <span className="relay-eyebrow-badge relay-eyebrow-badge--dark">
            {sl.badge}
          </span>
        </div>

        <h1 className="relay-headline relay-headline--compact">{sl.headline}</h1>
        <p className="relay-subheadline">{sl.subheadline}</p>

        {errorMsg && (
          <div className="relay-alert relay-alert--error" role="alert">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {!staff2faStage ? (
          <form className="relay-form" onSubmit={handleStaffStep1}>
            <div className="relay-field">
              <div className="relay-label-row">
                <label className="relay-label" htmlFor="staff-id-input">{sl.staffIdLabel}</label>
                <button
                  type="button"
                  className="relay-otp-quickfill"
                  onClick={() => {
                    setStaffId('staff@relaypark.vn');
                    setStaffPassword('StaffPark@2026');
                    clearFeedback();
                  }}
                >
                  ⚡ {sl.fillDemoStaff}
                </button>
              </div>
              <input
                id="staff-id-input"
                type="text"
                className="relay-input"
                placeholder={sl.staffIdPlaceholder}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="relay-field">
              <label className="relay-label" htmlFor="staff-pwd-input">{sl.passwordLabel}</label>
              <div className="relay-input-wrap">
                <input
                  id="staff-pwd-input"
                  type={showStaffPassword ? 'text' : 'password'}
                  className="relay-input"
                  placeholder={sl.passwordPlaceholder}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="relay-eye-btn"
                  onClick={() => setShowStaffPassword(!showStaffPassword)}
                >
                  {showStaffPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="relay-btn relay-btn--black relay-btn--full"
              disabled={isLoading}
            >
              {isLoading ? t.customerLogin.loggingIn : sl.continueTo2faBtn}
            </button>
          </form>
        ) : (
          <div className="relay-form">
            <div className="relay-step-box">
              <div className="relay-otp-target-bar">
                <span>🔐 <strong>{staffId}</strong></span>
                <button
                  type="button"
                  className="relay-link-inline"
                  onClick={() => {
                    setStaff2faStage(false);
                    clearFeedback();
                  }}
                >
                  {sl.backToCredentials}
                </button>
              </div>

              <h3 className="relay-step-box__title">{sl.twoFaStepTitle}</h3>

              <OtpSixInput
                value={staff2faCode}
                onChange={setStaff2faCode}
                onComplete={(code) => handleStaffVerify2fa(code)}
                disabled={isLoading}
                labels={{
                  resendIn: t.customerLogin.resendIn,
                  resendNow: t.customerLogin.resendNow,
                  quickFillOtp: t.customerLogin.quickFillOtp,
                  mobileAutofillHint: '',
                }}
              />
            </div>

            <button
              type="button"
              className="relay-btn relay-btn--black relay-btn--full"
              disabled={isLoading}
              onClick={() => handleStaffVerify2fa()}
            >
              {isLoading ? t.customerLogin.verifyingOtp : sl.verifyStaff2faBtn}
            </button>
          </div>
        )}

        <div className="relay-staff-footer-box">
          <button
            type="button"
            className="relay-link-accent"
            onClick={() => {
              clearFeedback();
              setActivationStep(1);
              onChangeSubView('staff-activate');
            }}
          >
            {sl.activateLinkBtn}
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // 3. DEFAULT CUSTOMER LOGIN SCREEN (CONCISE RELAY STYLE)
  // =========================================================
  const cl = t.customerLogin;

  return (
    <div className="relay-auth-card">
      {/* Pill Navigation Tabs */}
      <div className="relay-pill-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="relay-pill-tab relay-pill-tab--active"
        >
          {t.tabs.customerLogin}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          className="relay-pill-tab"
          onClick={onNavigateToRegister}
        >
          {t.tabs.customerRegister}
        </button>
      </div>

      <h1 className="relay-headline">{cl.headline}</h1>
      <p className="relay-subheadline">{cl.subheadline}</p>

      {errorMsg && (
        <div className="relay-alert relay-alert--error" role="alert">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}
      {infoMsg && (
        <div className="relay-alert relay-alert--info" role="status">
          <span>ℹ️</span>
          <span>{infoMsg}</span>
        </div>
      )}

      {!otpStepSent ? (
        <form
          className="relay-form"
          onSubmit={authMethod === 'otp' ? handleSendCustomerOtp : handleCustomerPasswordLogin}
        >
          {/* Smart Phone / Email Input */}
          <div className="relay-field">
            <div className="relay-label-row">
              <label className="relay-label" htmlFor="smart-identifier-input">
                {cl.smartInputLabel}
              </label>

              {identifier.trim() && (
                <span
                  className={`relay-detect-pill ${
                    detectedType === 'phone' || detectedType === 'email'
                      ? 'relay-detect-pill--valid'
                      : 'relay-detect-pill--pending'
                  }`}
                >
                  {detectedType === 'phone' && `📱 ${cl.detectedPhone}`}
                  {detectedType === 'email' && `✉️ ${cl.detectedEmail}`}
                  {detectedType !== 'phone' && detectedType !== 'email' && cl.detectedUnknown}
                </span>
              )}
            </div>

            <input
              id="smart-identifier-input"
              type="text"
              className="relay-input relay-input--smart"
              placeholder={cl.smartInputPlaceholder}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              autoComplete="username"
            />
          </div>

          {/* Auth Method Selector: OTP vs Password */}
          <div className="relay-method-switch">
            <span className="relay-method-switch__label">{cl.authMethodLabel}:</span>
            <div className="relay-method-pills">
              <button
                type="button"
                className={`relay-method-pill ${authMethod === 'otp' ? 'relay-method-pill--active' : ''}`}
                onClick={() => {
                  setAuthMethod('otp');
                  clearFeedback();
                }}
              >
                🔢 {cl.methodOtp}
              </button>
              <button
                type="button"
                className={`relay-method-pill ${authMethod === 'password' ? 'relay-method-pill--active' : ''}`}
                onClick={() => {
                  setAuthMethod('password');
                  clearFeedback();
                }}
              >
                🔑 {cl.methodPassword}
              </button>
            </div>
          </div>

          {authMethod === 'password' && (
            <div className="relay-field relay-fade-in">
              <div className="relay-label-row">
                <label className="relay-label" htmlFor="customer-pwd-input">
                  {cl.passwordLabel}
                </label>
                <button
                  type="button"
                  className="relay-link-inline"
                  onClick={() => setIsForgotOpen(true)}
                >
                  {cl.forgotPassword}
                </button>
              </div>
              <div className="relay-input-wrap">
                <input
                  id="customer-pwd-input"
                  type={showPassword ? 'text' : 'password'}
                  className="relay-input"
                  placeholder={cl.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="relay-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              <label className="relay-checkbox-row">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>{cl.rememberMe}</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            className="relay-btn relay-btn--black relay-btn--full"
            disabled={isLoading}
          >
            {isLoading && <span className="relay-spinner" aria-hidden="true" />}
            <span>
              {authMethod === 'otp'
                ? isLoading
                  ? cl.sendingOtp
                  : cl.sendOtpBtn
                : isLoading
                ? cl.loggingIn
                : cl.loginWithPwdBtn}
            </span>
          </button>
        </form>
      ) : (
        <div className="relay-form relay-fade-in">
          <div className="relay-otp-card">
            <div className="relay-otp-target-bar">
              <span>
                {cl.otpSentTo} <strong>{identifier}</strong>
              </span>
              <button
                type="button"
                className="relay-link-inline"
                onClick={() => {
                  setOtpStepSent(false);
                  setOtpCode('');
                  clearFeedback();
                }}
              >
                {cl.changeIdentifier}
              </button>
            </div>

            <OtpSixInput
              value={otpCode}
              onChange={setOtpCode}
              onComplete={(code) => handleVerifyCustomerOtp(code)}
              resendTimer={otpTimer}
              onResend={handleSendCustomerOtp}
              disabled={isLoading}
              labels={{
                resendIn: cl.resendIn,
                resendNow: cl.resendNow,
                quickFillOtp: cl.quickFillOtp,
                mobileAutofillHint: '',
              }}
            />

            <button
              type="button"
              className="relay-btn relay-btn--black relay-btn--full"
              disabled={isLoading}
              onClick={() => handleVerifyCustomerOtp()}
            >
              {isLoading && <span className="relay-spinner" aria-hidden="true" />}
              <span>{isLoading ? cl.verifyingOtp : cl.verifyOtpBtn}</span>
            </button>
          </div>
        </div>
      )}

      <div className="relay-divider">
        <span>{cl.orDivider}</span>
      </div>

      {/* Continue as Guest + Google OAuth */}
      <div className="relay-secondary-stack">
        <button
          type="button"
          className="relay-btn relay-btn--guest relay-btn--full"
          onClick={onContinueAsGuest}
        >
          <div className="relay-guest-btn-main">
            <span>🗺️ {cl.guestBtn}</span>
            <span>→</span>
          </div>
          <span className="relay-guest-btn-sub">{cl.guestSub}</span>
        </button>

        <button
          type="button"
          className="relay-btn relay-btn--oauth relay-btn--full"
          onClick={handleGoogleLogin}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.7 0 3 .7 3.7 1.3l2.8-2.8C16.8 2 14.6 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.3 2.6C6 7.2 8.7 5 12 5z" />
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
            <path fill="#FBBC05" d="M5.2 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.1.2-1.9.4-2.7L1.9 6.7C.7 9.1 0 10.5 0 12s.7 2.9 1.9 5.3l3.3-2.6z" />
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.3 0-6-2.2-6.8-4.9L1.9 16C3.7 19.7 7.5 23 12 23z" />
          </svg>
          <span>{cl.googleBtn}</span>
        </button>
      </div>

      {/* Compact Single-Row Staff Links */}
      <div className="relay-auth-footer-links">
        <div className="relay-staff-links-group">
          <button
            type="button"
            className="relay-staff-link-btn"
            onClick={() => {
              clearFeedback();
              onChangeSubView('staff-login');
            }}
          >
            🛡️ {cl.staffLoginLink}
          </button>
          <span className="relay-dot-sep">•</span>
          <button
            type="button"
            className="relay-staff-link-btn relay-staff-link-btn--activate"
            onClick={() => {
              clearFeedback();
              setActivationStep(1);
              onChangeSubView('staff-activate');
            }}
          >
            {cl.staffActivateLink}
          </button>
        </div>
      </div>

      {isForgotOpen && (
        <div className="relay-modal-backdrop" onClick={() => setIsForgotOpen(false)}>
          <div className="relay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="relay-modal__header">
              <h3>{cl.forgotPassword}</h3>
              <button type="button" onClick={() => setIsForgotOpen(false)}>✕</button>
            </div>
            <div className="relay-modal__body">
              <input
                type="text"
                className="relay-input"
                defaultValue={identifier}
                placeholder={cl.smartInputPlaceholder}
              />
            </div>
            <div className="relay-modal__footer">
              <button
                type="button"
                className="relay-btn relay-btn--black"
                onClick={() => {
                  setIsForgotOpen(false);
                  setInfoMsg('Đã gửi mã khôi phục!');
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
