import { useState } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import AuthShowcaseLayout from './AuthShowcaseLayout';
import { AuthAlert, AuthCheckbox, AuthField } from './AuthFields';
import ForgotPasswordDialog from './ForgotPasswordDialog';
import GoogleSignInButton from './GoogleSignInButton';
import { getErrorMessage } from '../api/apiError';
import { useLogin } from '../hooks/useAuth';
import { GOOGLE_CLIENT_ID } from '../lib/google-identity';

export default function LoginScreen({ onLoginSuccess, onTwoFactorRequired, onNavigateToRegister }) {
  const loginMutation = useLogin();

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Status & loading
  const isLoading = loginMutation.isPending;
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Handle standard password login
  const handlePasswordLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    // Customers sign in with an email; Manager/Staff accounts may also use their username.
    const identifier = email.trim();
    const isEmail = identifier.includes('@');
    if (!identifier) {
      setErrorMsg('Please enter your email or username!');
      return;
    }
    if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      setErrorMsg('Please enter a valid email address!');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password!');
      return;
    }

    loginMutation.mutate(
      { ...(isEmail ? { email: identifier } : { username: identifier }), password, rememberMe },
      {
        onSuccess: (result) => (result.kind === 'two-factor' ? onTwoFactorRequired(result) : onLoginSuccess(result)),
        onError: (error) => {
          const message = getErrorMessage(error, 'Login failed. Please check your credentials.');
          // Without a backend, point the user to the demo modes below.
          setErrorMsg(error.isNetworkError ? `${message} Start the .NET backend or use a demo account below.` : message);
        },
      },
    );
  };

  return (
    <AuthShowcaseLayout
      title="Welcome back"
      subtitle="Enter your credentials to access your account."
      photo="/lamborghini.jpg"
      tagline="Experience effortless, intelligent parking management crafted for luxury vehicles."
    >
      {errorMsg && <AuthAlert tone="error">{errorMsg}</AuthAlert>}
      {infoMsg && <AuthAlert tone="info">{infoMsg}</AuthAlert>}

      <form className="auth-shell__form" onSubmit={handlePasswordLogin} noValidate>
        <AuthField
          id="login-email"
          label="Email or username"
          icon={Mail}
          type="text"
          placeholder="name@domain.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />

        <AuthField
          id="login-password"
          label="Password"
          icon={Lock}
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          visible={showPassword}
          onToggleVisible={() => setShowPassword(!showPassword)}
          labelAside={
            <button type="button" className="auth-shell__link" onClick={() => setIsForgotPasswordOpen(true)}>
              Forgot password?
            </button>
          }
        />

        <AuthCheckbox checked={rememberMe} onChange={setRememberMe}>Remember me</AuthCheckbox>

        <button type="submit" className="auth-shell__submit" disabled={isLoading}>
          {isLoading ? 'Authenticating...' : 'Sign In'}
          {!isLoading && <ArrowRight size={20} aria-hidden="true" />}
        </button>

        {GOOGLE_CLIENT_ID && <div className="auth-shell__divider">Or continue with</div>}

        <GoogleSignInButton rememberMe={rememberMe} />
      </form>

      <p className="auth-shell__footer">
        Don't have an account?
        <button type="button" className="auth-shell__link auth-shell__link--muted" onClick={onNavigateToRegister}>
          Register now
        </button>
      </p>



      {isForgotPasswordOpen && (
        <ForgotPasswordDialog
          initialEmail={email}
          onClose={() => setIsForgotPasswordOpen(false)}
          onSent={(message) => {
            setErrorMsg('');
            setInfoMsg(message);
            setIsForgotPasswordOpen(false);
          }}
        />
      )}
    </AuthShowcaseLayout>
  );
}
