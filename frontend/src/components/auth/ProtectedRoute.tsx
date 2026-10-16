import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppSkeleton } from '@/components/shell/AppSkeleton';

// Only first-time Google sign-ups ever see it, so it stays out of the entry chunk.
const OnboardingModal = lazy(() =>
  import('@/components/onboarding/OnboardingModal').then((m) => ({ default: m.OnboardingModal }))
);

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Signed-out visitors go to /login?next=<where they were>; Login reads it back through safeNextPath.
 * While a stored session is being checked, the page shape shows instead of a spinner (§10.6).
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, needsOnboarding, completeOnboarding } = useAuth();
  const location = useLocation();

  if (isLoading) return <AppSkeleton variant="screen" />;

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} state={{ from: location }} replace />;
  }

  return (
    <>
      {children}
      {needsOnboarding ? (
        <Suspense fallback={null}>
          <OnboardingModal open onComplete={completeOnboarding} />
        </Suspense>
      ) : null}
    </>
  );
}
