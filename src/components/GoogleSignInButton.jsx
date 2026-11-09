import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { GOOGLE_CLIENT_ID, startGoogleSignIn } from '../lib/google-identity';

const LABELS = {
  signin_with: 'Sign in with Google',
  signup_with: 'Sign up with Google',
  continue_with: 'Continue with Google',
};

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" fill="#EA4335" />
      <path d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" fill="#4285F4" />
      <path d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" fill="#FBBC05" />
      <path d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" fill="#34A853" />
    </svg>
  );
}

/**
 * "Sign in with Google". The first sign-in creates the customer account, so it works on both
 * the Login and Register screens. The click takes the whole page to Google, which sends the
 * browser back to /auth/google/callback (GoogleCallbackPage) to finish signing in.
 *
 * @param {{
 *   rememberMe?: boolean,
 *   text?: 'signin_with' | 'signup_with' | 'continue_with',
 * }} props
 */
export default function GoogleSignInButton({ rememberMe = false, text = 'continue_with' }) {
  const location = useLocation();
  const [leaving, setLeaving] = useState(false);

  if (!GOOGLE_CLIENT_ID) return null;

  const signIn = () => {
    setLeaving(true);
    // The page that asked for login, so the callback can return there
    const from = location.state?.from;
    startGoogleSignIn({ rememberMe, returnTo: typeof from === 'string' ? from : undefined });
  };

  return (
    <div className="google-signin">
      <button type="button" className="google-signin__dark" onClick={signIn} disabled={leaving} aria-busy={leaving}>
        <span className="google-signin__face">
          <GoogleMark />
          {leaving ? 'Opening Google...' : LABELS[text]}
        </span>
      </button>
    </div>
  );
}
