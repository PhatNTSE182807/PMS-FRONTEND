import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import UserScreen from './components/UserScreen';
import RelayTabletMockup from './components/RelayTabletMockup';
import ApiStatusBadge from './components/ApiStatusBadge';
import { authService } from './services/authService';
import { authTranslations } from './i18n/authTranslations';
import './App.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ marginBottom: '0.75rem' }}>An error occurred</h2>
          <p style={{ maxWidth: '500px', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'Something went wrong.'}
          </p>
          <button
            type="button"
            className="relay-btn relay-btn--black"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Primary View: 'login' | 'register' | 'user'
  const [currentView, setCurrentView] = useState('login');
  // Sub-view inside 'login': 'customer-login' | 'staff-login' | 'staff-activate'
  const [authSubView, setAuthSubView] = useState('customer-login');

  const [currentUser, setCurrentUser] = useState(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Theme ('light' | 'dark')
  const [theme, setTheme] = useState(() => localStorage.getItem('relay_theme') || 'light');
  // Language ('vi' | 'en')
  const [lang, setLang] = useState(() => localStorage.getItem('relay_lang') || 'vi');

  // Notification Icon Auto Pop-up State (FR-LOT-04 & FR-SYS-06)
  const [activeNotifIdx, setActiveNotifIdx] = useState(0);
  const [isNotifPopVisible, setIsNotifPopVisible] = useState(true);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);

  const t = authTranslations[lang] || authTranslations.vi;
  const notifications = t.notifications || [];

  useEffect(() => {
    localStorage.setItem('relay_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('relay_lang', lang);
  }, [lang]);

  // Auto cycle pop-up from the notification bell icon every few seconds
  useEffect(() => {
    if (currentView === 'user' || isNotifMenuOpen || notifications.length === 0) return;

    const cycleInterval = setInterval(() => {
      // Fade out current pop-up briefly, then pop up the next notification
      setIsNotifPopVisible(false);
      setTimeout(() => {
        setActiveNotifIdx((prev) => (prev + 1) % notifications.length);
        setIsNotifPopVisible(true);
      }, 450);
    }, 4500);

    return () => clearInterval(cycleInterval);
  }, [currentView, isNotifMenuOpen, notifications.length]);

  // Check URL for staff activation link (?activate=staff or #activate-staff) or saved session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('activate') === 'staff' || window.location.hash === '#activate-staff') {
      setCurrentView('login');
      setAuthSubView('staff-activate');
      return;
    }

    const savedUser = authService.getCurrentUser();
    const token = authService.getToken();
    if (savedUser && token) {
      setCurrentUser(savedUser);
      setIsGuestMode(false);
      setCurrentView('user');
    }
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3200);
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsGuestMode(false);
    setCurrentView('user');
    showToast(
      lang === 'vi'
        ? `Xin chào, ${user.fullName || user.username}!`
        : `Welcome, ${user.fullName || user.username}!`
    );
  };

  const handleRegisterSuccess = (newUser) => {
    setCurrentUser(newUser);
    setIsGuestMode(false);
    setCurrentView('user');
    showToast(
      lang === 'vi'
        ? `Đã tạo tài khoản ${newUser.fullName}!`
        : `Account created for ${newUser.fullName}!`
    );
  };

  const handleContinueAsGuest = () => {
    setCurrentUser(null);
    setIsGuestMode(true);
    setCurrentView('user');
    showToast(
      lang === 'vi'
        ? 'Chế độ Khách: Chỉ cần đăng nhập khi bấm Đặt chỗ.'
        : 'Guest Mode: Sign in only when you book a slot.'
    );
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setIsGuestMode(false);
    setAuthSubView('customer-login');
    setCurrentView('login');
  };

  if (currentView === 'user') {
    return (
      <div className="pms-app">
        {toastMessage && (
          <div className="pms-toast" role="status">
            <span className="pms-toast__icon">✓</span>
            <span className="pms-toast__text">{toastMessage}</span>
            <button type="button" className="pms-toast__close" onClick={() => setToastMessage('')}>✕</button>
          </div>
        )}
        <ErrorBoundary>
          <div className="screen-user-layout">
            <UserScreen
              user={currentUser}
              isGuest={isGuestMode}
              onLogout={handleLogout}
              onRequireLogin={() => {
                setIsGuestMode(false);
                setAuthSubView('customer-login');
                setCurrentView('login');
              }}
            />
          </div>
        </ErrorBoundary>
      </div>
    );
  }

  const currentNotif = notifications[activeNotifIdx] || notifications[0];

  return (
    <div className={`relay-canvas relay-canvas--${theme}`}>
      {toastMessage && (
        <div className="pms-toast" role="status">
          <span className="pms-toast__icon">✓</span>
          <span className="pms-toast__text">{toastMessage}</span>
          <button type="button" className="pms-toast__close" onClick={() => setToastMessage('')}>✕</button>
        </div>
      )}

      {/* Main Split-Hero Container */}
      <ErrorBoundary>
        <main className="relay-split-hero">
          {/* LEFT COLUMN: Brand Header + Auth Stack */}
          <div className="relay-hero-left">
            {/* Minimal Brand & Utility Row */}
            <div className="relay-brand-bar">
              <div
                className="relay-brand-logo"
                onClick={() => {
                  setCurrentView('login');
                  setAuthSubView('customer-login');
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentView('login');
                    setAuthSubView('customer-login');
                  }
                }}
              >
                <span className="relay-logo-mark" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="6" fill="#FF5C00" />
                    <path
                      d="M8 17V7h5.2c2.1 0 3.5 1.2 3.5 3.1 0 1.9-1.4 3.1-3.5 3.1H10.5V17H8zm2.5-5.8h2.4c.8 0 1.3-.4 1.3-1.1 0-.7-.5-1.1-1.3-1.1h-2.4v2.2z"
                      fill="#FFFFFF"
                    />
                  </svg>
                </span>
                <div className="relay-brand-titles">
                  <span className="relay-brand-name">{t.brandName}</span>
                  <span className="relay-brand-tag">{t.brandTag}</span>
                </div>
              </div>

              {/* Utility Controls: Notification Bell Pop-up + Language + Theme */}
              <div className="relay-utility-controls">
                {/* Notification Icon with Auto-Cycling Pop-up */}
                <div className="relay-notif-anchor">
                  <button
                    type="button"
                    className={`relay-notif-btn ${isNotifMenuOpen ? 'relay-notif-btn--active' : ''}`}
                    onClick={() => setIsNotifMenuOpen((prev) => !prev)}
                    title={t.notifHeader}
                    aria-label={t.notifHeader}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <span className="relay-notif-badge">{notifications.length}</span>
                  </button>

                  {/* Auto-cycling single pop-up bubble from the bell icon */}
                  {!isNotifMenuOpen && currentNotif && (
                    <div
                      className={`relay-notif-popup ${
                        isNotifPopVisible ? 'relay-notif-popup--visible' : 'relay-notif-popup--hidden'
                      }`}
                      onClick={() => setIsNotifMenuOpen(true)}
                      role="status"
                    >
                      <div className="relay-notif-popup__arrow" />
                      <span className={`relay-notif-tag relay-notif-tag--${currentNotif.type}`}>
                        {currentNotif.code}
                      </span>
                      <div className="relay-notif-popup__content">
                        <strong>{currentNotif.title}</strong>
                        <span>{currentNotif.desc}</span>
                      </div>
                    </div>
                  )}

                  {/* Full dropdown list if user clicks the bell icon */}
                  {isNotifMenuOpen && (
                    <div className="relay-notif-dropdown">
                      <div className="relay-notif-dropdown__head">
                        <span>{t.notifHeader}</span>
                        <button type="button" onClick={() => setIsNotifMenuOpen(false)}>✕</button>
                      </div>
                      {notifications.map((item) => (
                        <div key={item.id} className="relay-notif-dropdown__item">
                          <span className={`relay-notif-tag relay-notif-tag--${item.type}`}>
                            {item.code}
                          </span>
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="relay-util-pill"
                  onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
                  title="Switch Language (Việt / Anh)"
                >
                  <strong>{lang === 'vi' ? 'VI' : 'EN'}</strong>
                </button>

                <button
                  type="button"
                  className="relay-util-pill"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  title="Toggle Dark / Light Mode"
                >
                  <span>{theme === 'light' ? '🌙' : '☀️'}</span>
                </button>
              </div>
            </div>

            {/* Auth Form Stack */}
            {currentView === 'login' ? (
              <LoginScreen
                t={t}
                authSubView={authSubView}
                onChangeSubView={setAuthSubView}
                onNavigateToRegister={() => setCurrentView('register')}
                onLoginSuccess={handleLoginSuccess}
                onContinueAsGuest={handleContinueAsGuest}
              />
            ) : (
              <RegisterScreen
                t={t}
                onNavigateToLogin={() => {
                  setAuthSubView('customer-login');
                  setCurrentView('login');
                }}
                onRegisterSuccess={handleRegisterSuccess}
              />
            )}
          </div>

          {/* RIGHT COLUMN: Floating Angled Dark Tablet Mockup */}
          <RelayTabletMockup
            t={t}
            onContinueAsGuest={handleContinueAsGuest}
          />
        </main>
      </ErrorBoundary>

      {/* Compact Dark Footer Bar */}
      <footer className="relay-dark-footer">
        <div className="relay-dark-footer__left">
          <span className="relay-footer-dot"></span>
          <span>{t.footer.securityNote}</span>
          <span className="relay-footer-sep">•</span>
          <span>{t.footer.statusNormal}</span>
        </div>

        <div className="relay-dark-footer__right">
          <ApiStatusBadge />
        </div>
      </footer>
    </div>
  );
}
