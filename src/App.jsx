import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import LoginScreen from './components/LoginScreen';
import OtpLoginScreen from './components/OtpLoginScreen';
import RegisterScreen from './components/RegisterScreen';
import UserScreen from './components/UserScreen';
import ApiStatusBadge from './components/ApiStatusBadge';
import AccountManagement from './pages/admin/AccountManagement';
import ParkingManagement from './pages/admin/ParkingManagement';
import Dashboard from './pages/admin/Dashboard';
import { authService } from './services/authService';
import './App.css';

// TEMP: hardcoded role to test the Account Management form with full Admin permissions.
// Replace with the real logged-in role once route guards are in place.
const currentUserRole = 'Admin';

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
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#3B3632', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#E85A4F', marginBottom: '0.75rem' }}>An error occurred</h2>
          <p style={{ color: '#6F6A64', maxWidth: '500px', marginBottom: '1.5rem' }}>
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

function RegisterRoute() {
  const navigate = useNavigate();
  return (
    <RegisterScreen
      onNavigateToLogin={() => navigate('/login')}
      onRegisterSuccess={() => navigate('/login')}
    />
  );
}

function UserDashboardRoute() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  // UserScreen needs a user; send anonymous visitors to login.
  if (!user) return <Navigate to="/login" replace />;

  return (
    <UserScreen
      user={user}
      onLogout={() => {
        authService.logout();
        navigate('/login');
      }}
    />
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  // Re-read on every navigation so the header reflects login/logout.
  const currentUser = authService.getCurrentUser();
  const isAuthRoute = ['/login', '/login-otp', '/register'].includes(location.pathname);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="pms-app">
      {/* Soft warm ambient light */}
      <div className="cyber-glow cyber-glow--cyan-top"></div>
      <div className="cyber-glow cyber-glow--blue-bottom"></div>

      <nav className="global-header">
        <div className="global-header__left">
          <div className="brand-pill" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <span className="brand-dot"></span>
            <span className="brand-text">PARKING MANAGEMENT SYSTEM - OJT</span>
          </div>
        </div>

        <div className="global-header__right">
          <ApiStatusBadge />
          {currentUser && (
            <button type="button" className="btn btn-danger-sm" onClick={handleLogout} title="Logout current session">
              Logout
            </button>
          )}
        </div>
      </nav>

      <ErrorBoundary>
        <main className={`pms-main-viewport ${isAuthRoute ? 'pms-main-viewport--auth' : ''}`}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<div className="screens-auth-layout"><LoginScreen /></div>} />
            <Route path="/login-otp" element={<div className="screens-auth-layout"><OtpLoginScreen /></div>} />
            <Route path="/register" element={<div className="screens-auth-layout"><RegisterRoute /></div>} />
            <Route path="/user-dashboard" element={<div className="screen-user-layout"><UserDashboardRoute /></div>} />
            <Route path="/admin/accounts" element={<AccountManagement currentUserRole={currentUserRole} />} />
            <Route path="/admin/parking" element={<ParkingManagement currentUserRole={currentUserRole} />} />
            <Route path="/admin/dashboard" element={<Dashboard currentUserRole={currentUserRole} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </ErrorBoundary>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
