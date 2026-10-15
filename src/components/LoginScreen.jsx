import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ParkingLogo from './ParkingLogo';
import { authService } from '../services/authService';

// Admin/Manager go to the back-office; everyone else lands on the user dashboard.
const getHomePath = (role) => (role === 'Admin' || role === 'Manager' ? '/admin/accounts' : '/user-dashboard');

export default function LoginScreen() {
  const navigate = useNavigate();
  const finishLogin = (user) => navigate(getHomePath(user?.role), { replace: true });

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Handle standard password login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your email!');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address!');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password!');
      return;
    }

    setIsLoading(true);
    const res = await authService.login(email, password, rememberMe);
    setIsLoading(false);

    if (res.success) {
      finishLogin(res.user);
    } else {
      // If network error, provide option to use demo mode
      setErrorMsg(res.message);
    }
  };

  // Demo auto-fill
  const fillDemoAccount = () => {
    setEmail('admin@admin.com');
    setPassword('Admin123.?');
    setErrorMsg('');
    setInfoMsg('Filled demo credentials! Click Login or use instant demo below.');
  };

  const handleInstantDemoLogin = () => {
    const demoUser = {
      userId: 'u-demo-vip',
      username: 'alex.rivers',
      fullName: 'Alex Rivers',
      email: 'alex.rivers@pms-ojt.vn',
      phoneNumber: '+84 988 123 456',
      role: 'User',
    };
    localStorage.setItem('pms_token', 'demo_active_token_user');
    localStorage.setItem('pms_user', JSON.stringify(demoUser));
    finishLogin(demoUser);
  };

  // Handle SSO mock login
  const handleSsoLogin = (provider) => {
    const ssoUser = {
      userId: `u-sso-${provider.toLowerCase()}`,
      username: `user_${provider.toLowerCase()}`,
      fullName: `${provider} User`,
      email: `user@${provider.toLowerCase()}.com`,
      phoneNumber: '+84 912 345 678',
      role: 'User',
    };
    localStorage.setItem('pms_token', `sso_${provider}_token`);
    localStorage.setItem('pms_user', JSON.stringify(ssoUser));
    finishLogin(ssoUser);
  };

  return (
    <div className="screen-wrapper">
      <div className="mockup-window">
        {/* Window Chrome Titlebar */}
        <div className="mockup-window__header">
          <div className="window-dots">
            <span className="dot dot-close"></span>
            <span className="dot dot-min"></span>
            <span className="dot dot-max"></span>
          </div>
          <div className="window-title">Parking Management System - OJT - Secure Authentication</div>
        </div>

        {/* Window Content */}
        <div className="mockup-window__body auth-screen-body">
          {/* Logo */}
          <div className="auth-brand-center">
            <ParkingLogo />
          </div>

          {/* Main Glass Card */}
          <div className="glass-card login-glass-card">
            {/* Notification messages */}
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

            {/* Login Form */}
            <form className="auth-form" onSubmit={handlePasswordLogin} noValidate>
              <div className="form-group">
                <input
                  id="login-email"
                  type="email"
                  className="cyber-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="form-group form-group--relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="cyber-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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

                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={() => setIsForgotPasswordOpen(true)}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary-cyan btn-full"
                disabled={isLoading}
              >
                {isLoading ? 'Authenticating...' : 'Login'}
              </button>
            </form>

            {/* Quick Demo Assist */}
            <div className="demo-helper-bar">
              <button
                type="button"
                className="demo-helper-btn"
                onClick={fillDemoAccount}
                title="Fill demo email and password"
              >
                Auto-fill Demo
              </button>
              <button
                type="button"
                className="demo-helper-btn demo-helper-btn--instant"
                onClick={handleInstantDemoLogin}
                title="Directly enter dashboard with VIP Demo account"
              >
                Instant Access Demo →
              </button>
            </div>

            {/* SSO Section */}
            <div className="sso-section">
              <div className="sso-divider">
                <span>Sign in with SSO</span>
              </div>

              <div className="sso-buttons">
                {/* Google */}
                <button
                  type="button"
                  className="sso-btn"
                  onClick={() => handleSsoLogin('Google')}
                  title="Sign in with Google"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.7 0 3 .7 3.7 1.3l2.8-2.8C16.8 2 14.6 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.3 2.6C6 7.2 8.7 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.2 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.1.2-1.9.4-2.7L1.9 6.7C.7 9.1 0 10.5 0 12s.7 2.9 1.9 5.3l3.3-2.6z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.3 0-6-2.2-6.8-4.9L1.9 16C3.7 19.7 7.5 23 12 23z"
                    />
                  </svg>
                </button>

                {/* Microsoft */}
                <button
                  type="button"
                  className="sso-btn"
                  onClick={() => handleSsoLogin('Microsoft')}
                  title="Sign in with Microsoft"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                    <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                    <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                    <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="auth-card-footer">
              <span>New to Parking Management System - OJT? </span>
              <button
                type="button"
                className="auth-link-highlight"
                onClick={() => navigate('/register')}
              >
                Register Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsForgotPasswordOpen(false)}>
          <div className="api-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>Reset Password</h3>
              <button type="button" className="api-modal__close" onClick={() => setIsForgotPasswordOpen(false)}>✕</button>
            </div>
            <div className="api-modal__body">
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Enter your registered Email or Vietnamese Phone number to receive password recovery instructions.
              </p>
              <input
                type="text"
                placeholder="Email or Phone Number"
                className="cyber-input"
                defaultValue={email}
              />
            </div>
            <div className="api-modal__footer">
              <button
                type="button"
                className="btn btn-outline-cyan"
                onClick={() => setIsForgotPasswordOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary-cyan"
                onClick={() => {
                  setInfoMsg('Password recovery instructions sent if the account exists!');
                  setIsForgotPasswordOpen(false);
                }}
              >
                Send Instructions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
