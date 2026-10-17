import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/apiError';
import { useGoogleLogin } from '../hooks/useAuth';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '../lib/google-identity';

// Google draws its button 200-400px wide and 40px high (size "large").
const GOOGLE_MAX_WIDTH = 400;
const GOOGLE_HEIGHT = 40;

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
 * the Login and Register screens. Hidden until VITE_GOOGLE_CLIENT_ID is set.
 *
 * `variant="dark"` shows our own dark button (Login/Register design). Google only signs in
 * through its own iframe button, so that one is laid invisibly over ours and takes the click.
 *
 * @param {{
 *   onLoginSuccess: (user: import('../lib/session').SessionUser) => void,
 *   onError: (message: string) => void,
 *   rememberMe?: boolean,
 *   text?: 'signin_with' | 'signup_with' | 'continue_with',
 *   variant?: 'google' | 'dark',
 * }} props
 */
export default function GoogleSignInButton({
  onLoginSuccess,
  onError,
  rememberMe = false,
  text = 'continue_with',
  variant = 'google',
}) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const googleLogin = useGoogleLogin();
  const [loadError, setLoadError] = useState('');
  const isDark = variant === 'dark';

  // Google calls back long after render; read the latest props through refs.
  const latest = useRef({ onLoginSuccess, onError, rememberMe, mutateAsync: googleLogin.mutateAsync });
  latest.current = { onLoginSuccess, onError, rememberMe, mutateAsync: googleLogin.mutateAsync };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    let observer;

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

        // Google draws a fixed-width iframe; match the form column as far as it allows.
        const columnWidth = Math.round((wrapperRef.current ?? containerRef.current).getBoundingClientRect().width);
        const width = Math.max(200, Math.min(GOOGLE_MAX_WIDTH, columnWidth));
        containerRef.current.replaceChildren();
        googleId.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: isDark ? 'rectangular' : 'pill',
          text,
          logo_alignment: 'center',
          width,
          locale: 'en',
        });

        // Dark variant: stretch the invisible Google button over the whole visible one.
        if (isDark && wrapperRef.current) {
          // Layout sizes (offsetWidth/Height) ignore transforms, such as our scale and the form's
          // fade-in animation, so they compare Google's real button with ours.
          const fit = () => {
            const face = wrapperRef.current;
            const overlay = containerRef.current;
            if (!face || !overlay) return;
            const naturalWidth = overlay.offsetWidth || width;
            const naturalHeight = overlay.offsetHeight || GOOGLE_HEIGHT;
            overlay.style.transform = `scale(${face.offsetWidth / naturalWidth}, ${face.offsetHeight / naturalHeight})`;
          };
          fit();
          observer = new ResizeObserver(fit);
          observer.observe(wrapperRef.current);
          observer.observe(containerRef.current);
        }
      })
      .catch((error) => !cancelled && setLoadError(error.message));

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [text, isDark]);

  if (!GOOGLE_CLIENT_ID) return null;

  const status = (
    <>
      {googleLogin.isPending && <p className="google-signin__status">Signing in with Google...</p>}
      {loadError && <p className="google-signin__status google-signin__status--error">{loadError}</p>}
    </>
  );

  if (isDark) {
    return (
      <div className="google-signin">
        <div ref={wrapperRef} className="google-signin__dark" aria-busy={googleLogin.isPending}>
          <span className="google-signin__face" aria-hidden="true">
            <GoogleMark />
            {LABELS[text]}
          </span>
          <div ref={containerRef} className="google-signin__overlay" />
        </div>
        {status}
      </div>
    );
  }

  return (
    <div className="google-signin">
      <div ref={containerRef} className="google-signin__button" aria-busy={googleLogin.isPending} />
      {status}
    </div>
  );
}
