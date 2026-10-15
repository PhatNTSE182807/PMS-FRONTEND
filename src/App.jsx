import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import UserScreen from './components/UserScreen';
import ApiStatusBadge from './components/ApiStatusBadge';
import { authService } from './services/authService';

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
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#f1f5f9', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#00f2fe', marginBottom: '0.75rem' }}>An error occurred</h2>
          <p style={{ color: '#94a3b8', maxWidth: '500px', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'Something went wrong.'}
          </p>
          <button
            type="button"
            className="btn btn-primary-cyan"
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
  // Navigation mode: 'login' | 'register' | 'user'
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Check saved session on mount
  useEffect(() => {
    const savedUser = authService.getCurrentUser();
    const token = authService.getToken();
    if (savedUser && token) {
      setCurrentUser(savedUser);
      setCurrentView('user');
    }
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Handle successful login
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setCurrentView('user');
    showToast(`Welcome back, ${user.fullName || user.username}! Login successful.`);
  };

  // Handle successful registration
  const handleRegisterSuccess = (info) => {
    showToast(`Account registered successfully for ${info.fullName}! Please log in.`);
    setCurrentView('login');
  };

  // Handle logout
  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentView('login');
    showToast('Logged out successfully. See you again!');
  };

  return (
    <div className="pms-app">
      {/* Dynamic Cyber Ambient Lighting */}
      <div className="cyber-glow cyber-glow--cyan-top"></div>
      <div className="cyber-glow cyber-glow--blue-bottom"></div>
      <div className="cyber-grid-overlay"></div>

      {/* Global Navigation Bar / Control Header */}
      <nav className="global-header">
        <div className="global-header__left">
          <div className="brand-pill" onClick={() => setCurrentView('login')} style={{ cursor: 'pointer' }}>
            <span className="brand-dot"></span>
            <span className="brand-text">PARKING MANAGEMENT SYSTEM - OJT</span>
          </div>

          {/* Quick Screen Switcher Tabs */}
          <div className="screen-nav-tabs">
            <button
              type="button"
              className={`nav-btn ${currentView === 'login' ? 'nav-btn--active' : ''}`}
              onClick={() => setCurrentView('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`nav-btn ${currentView === 'register' ? 'nav-btn--active' : ''}`}
              onClick={() => setCurrentView('register')}
            >
              Register
            </button>
            <button
              type="button"
              className={`nav-btn ${currentView === 'user' ? 'nav-btn--active' : ''}`}
              onClick={() => {
                if (!currentUser) {
                  const demoUser = {
                    userId: 'u-alex-rivers',
                    username: 'alex.rivers',
                    fullName: 'Alex Rivers',
                    email: 'alex.rivers@pms-ojt.vn',
                    phoneNumber: '+84 988 123 456',
                    role: 'User',
                  };
                  setCurrentUser(demoUser);
                }
                setCurrentView('user');
              }}
            >
              User Dashboard
            </button>
          </div>
        </div>

        <div className="global-header__right">
          {/* Backend Connection Indicator Badge */}
          <ApiStatusBadge />

          {currentUser && currentView !== 'user' && (
            <button
              type="button"
              className="btn btn-outline-cyan btn-sm"
              onClick={() => setCurrentView('user')}
            >
              Dashboard ({currentUser.username})
            </button>
          )}

          {currentUser && (
            <button
              type="button"
              className="btn btn-danger-sm"
              onClick={handleLogout}
              title="Logout current session"
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="pms-toast" role="status">
          <span className="pms-toast__icon">✓</span>
          <span className="pms-toast__text">{toastMessage}</span>
          <button type="button" className="pms-toast__close" onClick={() => setToastMessage('')}>✕</button>
        </div>
      )}

      {/* Main Single Screen Viewport */}
      <ErrorBoundary>
        <main className={`pms-main-viewport ${currentView !== 'user' ? 'pms-main-viewport--auth' : ''}`}>
          {/* Luxury Lamborghini Supercar Background for Login & Register */}
          {currentView !== 'user' && (
            <div className="auth-supercar-bg" aria-hidden="true">
              <div className="auth-supercar-bg__img" style={{ backgroundImage: `url('/lamborghini.jpg')` }} />
              <div className="auth-supercar-bg__overlay" />
              <div className="auth-supercar-bg__vignette" />
            </div>
          )}

          {/* VIEW 1: Login Screen */}
          {currentView === 'login' && (
            <div className="screens-single-layout">
              <LoginScreen
                onLoginSuccess={handleLoginSuccess}
                onNavigateToRegister={() => setCurrentView('register')}
              />
            </div>
          )}

          {/* VIEW 2: Register Screen */}
          {currentView === 'register' && (
            <div className="screens-single-layout">
              <RegisterScreen
                onNavigateToLogin={() => setCurrentView('login')}
                onRegisterSuccess={handleRegisterSuccess}
              />
            </div>
          )}

          {/* VIEW 3: User Screen (Image 2 Dashboard) */}
          {currentView === 'user' && (
            <div className="screen-user-layout">
              <UserScreen
                user={currentUser}
                onLogout={handleLogout}
              />
            </div>
          )}
        </main>
      </ErrorBoundary>
    </div>
  );
}
