import { useRef, useEffect } from 'react';

/**
 * OtpSixInput - 6-box OTP component with:
 * - Auto-advance to next input on digit entry
 * - Backspace / Arrow key navigation
 * - Full 6-digit clipboard paste support in any box
 * - Mobile SMS auto-fill (autoComplete="one-time-code" + WebOTP API)
 * - Countdown timer & 1-click sample OTP helper
 */
export default function OtpSixInput({
  value = '',
  onChange,
  onComplete,
  resendTimer = 0,
  onResend,
  disabled = false,
  autoFocus = true,
  labels = {
    resendIn: 'Gửi lại mã sau',
    resendNow: 'Gửi lại mã OTP',
    quickFillOtp: 'Điền nhanh OTP mẫu (123456)',
    mobileAutofillHint: 'Hỗ trợ tự động điền từ SMS trên điện thoại và dán (Ctrl+V) 6 số.',
  },
}) {
  const inputRefs = useRef([]);

  // Normalize value into an array of 6 characters
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  // Auto-focus first empty input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // WebOTP API for mobile browsers (Android Chrome / supported mobile browsers)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'OTPCredential' in window && navigator.credentials) {
      const ac = new AbortController();
      navigator.credentials
        .get({
          otp: { transport: ['sms'] },
          signal: ac.signal,
        })
        .then((otp) => {
          if (otp && otp.code) {
            const cleaned = otp.code.replace(/\D/g, '').slice(0, 6);
            if (cleaned) {
              onChange(cleaned);
              if (cleaned.length === 6 && onComplete) {
                onComplete(cleaned);
              }
            }
          }
        })
        .catch(() => {
          // Ignore abort or unsupported errors silently
        });
      return () => ac.abort();
    }
  }, [onChange, onComplete]);

  const triggerUpdate = (newDigits) => {
    const joined = newDigits.join('').slice(0, 6);
    onChange(joined);
    if (joined.length === 6 && !newDigits.includes('') && onComplete) {
      onComplete(joined);
    }
  };

  const handleInputChange = (index, e) => {
    const raw = e.target.value;
    const numeric = raw.replace(/\D/g, '');

    if (!numeric) {
      const next = [...digits];
      next[index] = '';
      triggerUpdate(next);
      return;
    }

    // If user typed or mobile keyboard auto-filled multiple digits at once
    if (numeric.length > 1) {
      const next = [...digits];
      for (let i = 0; i < numeric.length && index + i < 6; i += 1) {
        next[index + i] = numeric[i];
      }
      triggerUpdate(next);
      const focusIdx = Math.min(index + numeric.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    // Single digit entry -> set and jump to next box
    const next = [...digits];
    next[index] = numeric[0];
    triggerUpdate(next);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select?.();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        triggerUpdate(next);
      } else if (index > 0) {
        next[index - 1] = '';
        triggerUpdate(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text') || '';
    const pastedDigits = pastedText.replace(/\D/g, '').slice(0, 6);
    if (!pastedDigits) return;

    const next = Array.from({ length: 6 }, (_, i) => pastedDigits[i] || '');
    triggerUpdate(next);

    const lastIdx = Math.min(pastedDigits.length, 6) - 1;
    if (lastIdx >= 0) {
      inputRefs.current[lastIdx]?.focus();
    }
  };

  const handleQuickFill = () => {
    const sample = ['1', '2', '3', '4', '5', '6'];
    triggerUpdate(sample);
    inputRefs.current[5]?.focus();
  };

  return (
    <div className="relay-otp-wrap">
      <div className="relay-otp-boxes" role="group" aria-label="6-digit OTP verification code">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
            className={`relay-otp-box ${digit ? 'relay-otp-box--filled' : ''}`}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleInputChange(idx, e)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            aria-label={`OTP digit ${idx + 1}`}
          />
        ))}
      </div>

      <div className="relay-otp-meta">
        <div className="relay-otp-resend">
          {onResend && (
            resendTimer > 0 ? (
              <span className="relay-otp-timer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {labels.resendIn} <strong>{resendTimer}s</strong>
              </span>
            ) : (
              <button
                type="button"
                className="relay-link-inline"
                onClick={onResend}
                disabled={disabled}
              >
                {labels.resendNow}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className="relay-otp-quickfill"
          onClick={handleQuickFill}
          disabled={disabled}
        >
          ⚡ {labels.quickFillOtp}
        </button>
      </div>

      {labels.mobileAutofillHint && (
        <p className="relay-otp-hint">{labels.mobileAutofillHint}</p>
      )}
    </div>
  );
}
