import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/apiError';
import { useGoogleLogin } from '../hooks/useAuth';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '../lib/google-identity';

/**
 * Google's own "Sign in with Google" button. The first sign-in creates the customer account,
 * so it works on both the Login and Register screens. Hidden until VITE_GOOGLE_CLIENT_ID is set.
 *
 * @param {{
 *   onLoginSuccess: (user: import('../lib/session').SessionUser) => void,
 *   onError: (message: string) => void,
 *   rememberMe?: boolean,
 *   text?: 'signin_with' | 'signup_with' | 'continue_with',
 *   theme?: 'outline' | 'filled_blue' | 'filled_black',
 *   shape?: 'rectangular' | 'pill',
 * }} props
 */
export default function GoogleSignInButton({
  onLoginSuccess,
  onError,
  rememberMe = false,
  text = 'continue_with',
  theme = 'outline',
  shape = 'pill',
}) {
  const containerRef = useRef(null);
  const googleLogin = useGoogleLogin();
  const [loadError, setLoadError] = useState('');

  // Google calls back long after render; read the latest props through refs.
  const latest = useRef({ onLoginSuccess, onError, rememberMe, mutateAsync: googleLogin.mutateAsync });
  latest.current = { onLoginSuccess, onError, rememberMe, mutateAsync: googleLogin.mutateAsync };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;

    loadGoogleIdentity()
      .then((googleId) => {
        if (cancelled || !containerRef.current) return;
        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          callback: async ({ credential }) => {
            const { mutateAsync, rememberMe: remember, onLoginSuccess: done, onError: fail } = latest.current;
            try {
              done(await mutateAsync({ idToken: credential, rememberMe: remember }));
            } catch (error) {
              fail(getErrorMessage(error, 'Google sign-in failed. Please try again.'));
            }
          },
        });
        containerRef.current.replaceChildren();
        googleId.renderButton(containerRef.current, {
          theme,
          size: 'large',
          shape,
          text,
          logo_alignment: 'center',
          // Google draws a fixed-width iframe (200–400px); match the form column.
          width: Math.max(200, Math.min(400, Math.round(containerRef.current.getBoundingClientRect().width))),
          locale: 'en',
        });
      })
      .catch((error) => !cancelled && setLoadError(error.message));

    return () => {
      cancelled = true;
    };
  }, [text, theme, shape]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="google-signin">
      <div ref={containerRef} className="google-signin__button" aria-busy={googleLogin.isPending} />
      {googleLogin.isPending && <p className="google-signin__status">Signing in with Google...</p>}
      {loadError && <p className="google-signin__status google-signin__status--error">{loadError}</p>}
    </div>
  );
}
