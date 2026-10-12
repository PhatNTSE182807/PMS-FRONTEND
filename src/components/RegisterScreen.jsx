import { useState, useEffect, useRef } from 'react';
import OtpSixInput from './OtpSixInput';
import { detectIdentifierType } from './LoginScreen';
import { authService } from '../services/authService';

export default function RegisterScreen({
  t,
  onNavigateToLogin,
  onRegisterSuccess,
}) {
  const cr = t.customerRegister;
  const cl = t.customerLogin;

  const [regStage, setRegStage] = useState('account-otp'); // 'account-otp' | 'vehicle-onboarding'

  const [contact, setContact] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  const [registeredUser, setRegisteredUser] = useState(null);

  // Step 2: Vehicle Onboarding State
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [vehicleBrand, setVehicleBrand] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const detectedType = detectIdentifierType(contact);

  const startCountdown = (sec = 60) => {
    setOtpTimer(sec);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendRegOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!contact.trim()) {
      setErrorMsg(t.errors.emptyIdentifier);
      return;
    }
    if (detectedType !== 'phone' && detectedType !== 'email') {
      setErrorMsg(t.errors.invalidIdentifier);
      return;
    }

    setIsLoading(true);
    await authService.requestOtp(contact.trim());
    setIsLoading(false);

    setOtpSent(true);
    setOtpCode('');
    startCountdown(60);
  };

  const handleVerifyRegOtp = async (codeOverride) => {
    setErrorMsg('');
    const finalCode = typeof codeOverride === 'string' ? codeOverride : otpCode;

    if (!finalCode || finalCode.length < 6) {
      setErrorMsg(t.errors.invalidOtp);
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 450));
    setIsLoading(false);

    if (finalCode !== '123456' && finalCode.length !== 6) {
      setErrorMsg(t.errors.wrongOtp);
      return;
    }

    const cleanContact = contact.trim();
    const isEmail = cleanContact.includes('@');
    const derivedName =
      displayName.trim() ||
      (isEmail ? cleanContact.split('@')[0] : `Khách (${cleanContact.slice(-4)})`);

    const newUser = {
      userId: `u-${Date.now()}`,
      username: isEmail ? cleanContact.split('@')[0] : cleanContact.replace(/\s+/g, ''),
      fullName: derivedName,
      email: isEmail ? cleanContact : `${cleanContact.replace(/\s+/g, '')}@relaypark.vn`,
      phoneNumber: isEmail ? '0988 123 456' : cleanContact,
      role: 'Customer',
    };

    localStorage.setItem('pms_token', 'customer_registered_otp_token');
    localStorage.setItem('pms_user', JSON.stringify(newUser));
    setRegisteredUser(newUser);
    setRegStage('vehicle-onboarding');
  };

  const handleCompleteWithVehicle = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!licensePlate.trim()) {
      setErrorMsg(t.errors.emptyLicensePlate);
      return;
    }

    setIsLoading(true);
    const typeMap = { car: 1, suv: 2, moto: 3, ev: 4 };
    await authService.addVehicle({
      licensePlate: licensePlate.trim().toUpperCase(),
      vehicleTypeId: typeMap[vehicleType] || 1,
      brand: vehicleBrand.trim() || 'VinFast',
      model: vehicleType.toUpperCase(),
      color: 'White',
      isDefault: true,
    });
    setIsLoading(false);

    const userWithVehicle = {
      ...registeredUser,
      onboardingVehicle: {
        licensePlate: licensePlate.trim().toUpperCase(),
        vehicleType,
        brand: vehicleBrand.trim() || 'Primary Vehicle',
      },
    };
    localStorage.setItem('pms_user', JSON.stringify(userWithVehicle));
    onRegisterSuccess(userWithVehicle);
  };

  const handleSkipVehicleOnboarding = () => {
    onRegisterSuccess(registeredUser);
  };

  // =========================================================
  // STEP 2: SKIPPABLE VEHICLE ONBOARDING
  // =========================================================
  if (regStage === 'vehicle-onboarding') {
    const vehicleOptions = [
      { key: 'car', icon: '🚗', label: cr.vehicleTypes.car },
      { key: 'suv', icon: '🚙', label: cr.vehicleTypes.suv },
      { key: 'ev', icon: '⚡', label: cr.vehicleTypes.ev },
      { key: 'moto', icon: '🛵', label: cr.vehicleTypes.moto },
    ];

    return (
      <div className="relay-auth-card relay-fade-in">
        <div className="relay-eyebrow-badge relay-eyebrow-badge--orange">
          <span>{cr.step2Badge}</span>
        </div>

        <h1 className="relay-headline relay-headline--compact">{cr.onboardingTitle}</h1>
        <p className="relay-subheadline">{cr.onboardingSub}</p>

        {errorMsg && (
          <div className="relay-alert relay-alert--error" role="alert">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form className="relay-form" onSubmit={handleCompleteWithVehicle}>
          <div className="relay-field">
            <div className="relay-label-row">
              <label className="relay-label" htmlFor="onboarding-plate-input">
                {cr.licensePlateLabel}
              </label>
              {licensePlate.trim() && (
                <span className="relay-plate-preview">
                  🇻🇳 {licensePlate.trim().toUpperCase()}
                </span>
              )}
            </div>
            <input
              id="onboarding-plate-input"
              type="text"
              className="relay-input relay-input--plate"
              placeholder={cr.licensePlatePlaceholder}
              value={licensePlate}
              onChange={(e) => {
                setLicensePlate(e.target.value.toUpperCase());
                if (errorMsg) setErrorMsg('');
              }}
            />
          </div>

          <div className="relay-field">
            <label className="relay-label">{cr.vehicleTypeLabel}</label>
            <div className="relay-vehicle-grid">
              {vehicleOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`relay-vehicle-option ${
                    vehicleType === opt.key ? 'relay-vehicle-option--active' : ''
                  }`}
                  onClick={() => setVehicleType(opt.key)}
                >
                  <span className="relay-vehicle-option__icon">{opt.icon}</span>
                  <span className="relay-vehicle-option__text">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relay-field">
            <label className="relay-label" htmlFor="onboarding-brand-input">
              {cr.vehicleBrandLabel}
            </label>
            <input
              id="onboarding-brand-input"
              type="text"
              className="relay-input"
              placeholder={cr.vehicleBrandPlaceholder}
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="relay-btn relay-btn--black relay-btn--full"
            disabled={isLoading}
          >
            {isLoading && <span className="relay-spinner" aria-hidden="true" />}
            <span>{cr.completeWithVehicleBtn}</span>
          </button>

          <button
            type="button"
            className="relay-btn relay-btn--skip relay-btn--full"
            onClick={handleSkipVehicleOnboarding}
          >
            {cr.skipVehicleBtn}
          </button>
        </form>
      </div>
    );
  }

  // =========================================================
  // STEP 1: MINIMAL PHONE/EMAIL + OTP REGISTRATION
  // =========================================================
  return (
    <div className="relay-auth-card">
      <div className="relay-pill-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected="false"
          className="relay-pill-tab"
          onClick={onNavigateToLogin}
        >
          {t.tabs.customerLogin}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="relay-pill-tab relay-pill-tab--active"
        >
          {t.tabs.customerRegister}
        </button>
      </div>

      <h1 className="relay-headline">{cr.headline}</h1>
      <p className="relay-subheadline">{cr.subheadline}</p>

      {errorMsg && (
        <div className="relay-alert relay-alert--error" role="alert">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {!otpSent ? (
        <form className="relay-form" onSubmit={handleSendRegOtp}>
          <div className="relay-field">
            <div className="relay-label-row">
              <label className="relay-label" htmlFor="reg-contact-input">
                {cr.phoneOrEmailLabel}
              </label>
              {contact.trim() && (
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
              id="reg-contact-input"
              type="text"
              className="relay-input relay-input--smart"
              placeholder={cr.phoneOrEmailPlaceholder}
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              autoComplete="tel"
            />
          </div>

          <div className="relay-field">
            <label className="relay-label" htmlFor="reg-name-input">
              {cr.fullNameLabel}
            </label>
            <input
              id="reg-name-input"
              type="text"
              className="relay-input"
              placeholder={cr.fullNamePlaceholder}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <button
            type="submit"
            className="relay-btn relay-btn--black relay-btn--full"
            disabled={isLoading}
          >
            {isLoading && <span className="relay-spinner" aria-hidden="true" />}
            <span>{isLoading ? cl.sendingOtp : cr.sendRegOtpBtn}</span>
          </button>

          <p className="relay-terms-note">
            {cr.termsPrefix}{' '}
            <button type="button" className="relay-link-inline" onClick={() => setIsTermsOpen(true)}>
              {cr.termsLink}
            </button>{' '}
            {cr.andText}{' '}
            <button type="button" className="relay-link-inline" onClick={() => setIsTermsOpen(true)}>
              {cr.privacyLink}
            </button>
          </p>
        </form>
      ) : (
        <div className="relay-form relay-fade-in">
          <div className="relay-otp-card">
            <div className="relay-otp-target-bar">
              <span>
                {cl.otpSentTo} <strong>{contact}</strong>
              </span>
              <button
                type="button"
                className="relay-link-inline"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode('');
                  setErrorMsg('');
                }}
              >
                {cl.changeIdentifier}
              </button>
            </div>

            <OtpSixInput
              value={otpCode}
              onChange={setOtpCode}
              onComplete={(code) => handleVerifyRegOtp(code)}
              resendTimer={otpTimer}
              onResend={handleSendRegOtp}
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
              onClick={() => handleVerifyRegOtp()}
            >
              {isLoading && <span className="relay-spinner" aria-hidden="true" />}
              <span>{isLoading ? cl.verifyingOtp : cr.verifyRegOtpBtn}</span>
            </button>
          </div>
        </div>
      )}

      {isTermsOpen && (
        <div className="relay-modal-backdrop" onClick={() => setIsTermsOpen(false)}>
          <div className="relay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="relay-modal__header">
              <h3>{cr.termsLink} & {cr.privacyLink}</h3>
              <button type="button" onClick={() => setIsTermsOpen(false)}>✕</button>
            </div>
            <div className="relay-modal__body">
              <p>1. Đặt chỗ giữ vị trí tối đa 30 phút.</p>
              <p style={{ marginTop: '0.4rem' }}>2. Mở thanh chắn tự động bằng Camera AI.</p>
              <p style={{ marginTop: '0.4rem' }}>3. Bảo mật dữ liệu chuẩn TLS 1.3.</p>
            </div>
            <div className="relay-modal__footer">
              <button type="button" className="relay-btn relay-btn--black" onClick={() => setIsTermsOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
