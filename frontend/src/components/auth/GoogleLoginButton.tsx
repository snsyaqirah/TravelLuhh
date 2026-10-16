// "Continue with Google" in Google's own button style (light: white with a #747775 rule; dark: #131314 with a
// #8E918F rule) and the unchanged four-colour G, as Google's branding rules ask. The redirect goes through the
// backend (/oauth2/authorization/google); a ?next path rides along in sessionStorage for the callback.
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { rememberOAuthNext } from '@/components/frontdoor/oauthNext';
import { cn } from '@/lib/utils';

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20" className={className}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

interface GoogleLoginButtonProps {
  /** Where to land after Google (a ?next from Login). Sanitised before it's stored. */
  next?: string | null;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function GoogleLoginButton({ next, label = 'Continue with Google', disabled, className }: GoogleLoginButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [leaving, setLeaving] = useState(false);

  // Coming back with the browser's Back button restores this page from the cache: make the button usable again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLeaving(false);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  return (
    <button
      type="button"
      disabled={disabled || leaving}
      aria-busy={leaving || undefined}
      onClick={() => {
        setLeaving(true);
        rememberOAuthNext(next);
        loginWithGoogle();
      }}
      className={cn(
        'inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border px-4 font-sans text-[15px] font-medium leading-5 transition-colors duration-micro',
        'border-[#747775] bg-white text-[#1F1F1F] hover:bg-[#F7F8F8]',
        'dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1F1F21]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <GoogleMark className="shrink-0" />
      <span>{leaving ? 'Opening Google…' : label}</span>
    </button>
  );
}
